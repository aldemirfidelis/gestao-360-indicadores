'use client';

import { ChangeEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BriefcaseBusiness, Loader2, LogOut, RefreshCw } from 'lucide-react';
import {
  type CandidateSession,
  candidateApi,
  clearCandidateToken,
  companyQuery,
  getCandidateToken,
  resolveCareersCompanySlug,
  setCandidateToken,
} from '@/lib/candidate-api';
import { portalCounters } from '@/lib/candidate/progress';
import {
  type Application,
  type CandidateDocument,
  type CandidateProfileData,
  type DataRequest,
  type Offer,
  type PortalData,
  type PreAdmission,
  type PreAdmissionDocument,
  type ProfessionalForm,
  type Profile,
  type ProfileForm,
  type StoredContent,
  EMPTY_PROFESSIONAL_FORM,
} from '@/lib/candidate/types';
import { AuthScreen, type AuthFormState, type AuthMode } from '@/components/candidate/auth-screen';
import { ApplicationsSection } from '@/components/candidate/applications-section';
import { DocumentsSection } from '@/components/candidate/documents-section';
import { OverviewSection } from '@/components/candidate/overview-section';
import { PrivacySection } from '@/components/candidate/privacy-section';
import { ProfileSection } from '@/components/candidate/profile-section';
import { PORTAL_TABS, type PortalTab } from '@/components/candidate/tabs';
import { Button, initials } from '@/components/candidate/ui';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export default function CandidatePortalPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-300">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando área do candidato…
        </main>
      }
    >
      <CandidatePortalContent />
    </Suspense>
  );
}

function CandidatePortalContent() {
  const searchParams = useSearchParams();
  const empresa = useMemo(() => resolveCareersCompanySlug(searchParams.get('empresa')), [searchParams]);
  const suffix = companyQuery(empresa);
  const publicSuffix = empresa ? `?empresa=${encodeURIComponent(empresa)}` : '';
  const vacanciesHref = `/carreiras${publicSuffix}`;

  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<PortalTab>('inicio');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState<AuthFormState>({ name: '', email: '', phone: '', code: '', password: '' });
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({ name: '', phone: '', headline: '', city: '', linkedinUrl: '', portfolioUrl: '' });
  const [professionalForm, setProfessionalForm] = useState<ProfessionalForm>({ ...EMPTY_PROFESSIONAL_FORM });
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [preAdmissions, setPreAdmissions] = useState<PreAdmission[]>([]);
  const [dataRequestForm, setDataRequestForm] = useState({ type: 'ACCESS', details: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ kind: 'CV', applicationId: '' });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Sessão inicial. O login social devolve o token no FRAGMENTO da URL
   * (`#token=…`), que não vai ao servidor nem entra em log; consumimos e
   * limpamos da barra de endereços para não ficar em histórico.
   */
  useEffect(() => {
    const hash = typeof window === 'undefined' ? '' : window.location.hash;
    const fromHash = hash.startsWith('#token=') ? decodeURIComponent(hash.slice('#token='.length)) : null;
    if (fromHash) {
      setCandidateToken(fromHash);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setToken(fromHash);
      return;
    }
    setToken(getCandidateToken());
  }, []);

  /** Erro devolvido pelo callback do provedor social. */
  useEffect(() => {
    const reason = searchParams.get('erroLogin');
    if (reason) setAuthError(reason);
  }, [searchParams]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, apps, docs, requests, myOffers, myPreAdmissions] = await Promise.all([
        candidateApi<Profile>('/careers/candidate/me'),
        candidateApi<Application[]>('/careers/candidate/applications'),
        candidateApi<CandidateDocument[]>('/careers/candidate/documents'),
        candidateApi<DataRequest[]>('/careers/candidate/data-requests'),
        candidateApi<Offer[]>('/careers/candidate/offers'),
        candidateApi<PreAdmission[]>('/careers/candidate/pre-admissions'),
      ]);
      setProfile(me);
      setProfileForm({
        name: me.name ?? '',
        phone: me.phone ?? '',
        headline: me.headline ?? '',
        city: me.city ?? '',
        linkedinUrl: me.linkedinUrl ?? '',
        portfolioUrl: me.portfolioUrl ?? '',
      });
      setProfessionalForm(toProfessionalForm(me.profileData));
      setApplications(apps);
      setDocuments(docs);
      setDataRequests(requests);
      setOffers(myOffers);
      setPreAdmissions(myPreAdmissions);
    } catch (e) {
      setError((e as Error).message);
      if ((e as { status?: number }).status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadPortal();
  }, [token, loadPortal]);

  async function submitAuth() {
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const session = await candidateApi<CandidateSession>(authEndpoint(authMode, suffix), {
        method: 'POST',
        json:
          authMode === 'register'
            ? { name: authForm.name, email: authForm.email, phone: authForm.phone, password: authForm.password }
            : authMode === 'reset'
              ? { email: authForm.email, code: authForm.code, password: authForm.password }
              : { email: authForm.email, password: authForm.password },
      });
      setCandidateToken(session.token);
      setToken(session.token);
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function requestReset() {
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      await candidateApi('/careers/candidates/forgot-password', { method: 'POST', json: { email: authForm.email } });
      setAuthMessage('Se houver uma conta com este e-mail, enviamos um código de redefinição.');
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    clearCandidateToken();
    setToken(null);
    setProfile(null);
    setApplications([]);
    setDocuments([]);
    setDataRequests([]);
    setOffers([]);
    setPreAdmissions([]);
    setTab('inicio');
  }

  /** Toda mutação recarrega o portal: os painéis se influenciam (enviar documento muda a pré-admissão). */
  async function mutate(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await loadPortal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    setError(null);
    try {
      const profileData: CandidateProfileData = {
        about: professionalForm.about,
        availableForRelocation: professionalForm.availableForRelocation,
        availableForTravel: professionalForm.availableForTravel,
        desiredSalary: professionalForm.desiredSalary,
        availabilityToStart: professionalForm.availabilityToStart,
        skills: splitSkills(professionalForm.skills),
        experiences: professionalForm.experiences,
        education: professionalForm.education,
        languages: professionalForm.languages,
      };
      const updated = await candidateApi<Profile>('/careers/candidate/me', { method: 'PATCH', json: { ...profileForm, profileData } });
      setProfile(updated);
      setProfessionalForm(toProfessionalForm(updated.profileData));
      setSavedAt(Date.now());
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedAt(0), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function withdraw(id: string) {
    if (!window.confirm('Deseja desistir desta candidatura? A empresa é avisada e a ação não pode ser desfeita.')) return;
    void mutate(async () => {
      await candidateApi(`/careers/candidate/applications/${id}/withdraw`, { method: 'POST' });
    });
  }

  function uploadDocument() {
    if (!file) return;
    void mutate(async () => {
      const contentBase64 = await fileToBase64(file);
      await candidateApi('/careers/candidate/documents', {
        method: 'POST',
        json: {
          kind: uploadForm.kind,
          applicationId: uploadForm.applicationId || undefined,
          fileName: file.name,
          mimeType: uploadMimeType(file),
          contentBase64,
        },
      });
      setFile(null);
    });
  }

  async function downloadDocument(id: string) {
    setBusy(true);
    setError(null);
    try {
      downloadBase64(await candidateApi<StoredContent>(`/careers/candidate/documents/${id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function deleteDocument(id: string) {
    if (!window.confirm('Remover este documento do seu perfil?')) return;
    void mutate(async () => {
      await candidateApi(`/careers/candidate/documents/${id}`, { method: 'DELETE' });
    });
  }

  function createDataRequest() {
    void mutate(async () => {
      await candidateApi('/careers/candidate/data-requests', { method: 'POST', json: dataRequestForm });
      setDataRequestForm({ type: 'ACCESS', details: '' });
    });
  }

  function decideOffer(id: string, decision: 'ACCEPT' | 'DECLINE') {
    const reason = decision === 'DECLINE' ? window.prompt('Motivo da recusa (opcional):') ?? undefined : undefined;
    void mutate(async () => {
      await candidateApi(`/careers/candidate/offers/${id}/decision`, { method: 'POST', json: { decision, reason } });
    });
  }

  function submitPreAdmissionDocument(requirementId: string, candidateDocumentId: string) {
    if (!candidateDocumentId) return;
    void mutate(async () => {
      await candidateApi(`/careers/candidate/pre-admission-documents/${requirementId}/submit`, { method: 'POST', json: { candidateDocumentId } });
    });
  }

  /** Envia o arquivo e já o vincula ao item da pré-admissão, em um passo só. */
  function attachPreAdmissionFile(item: PreAdmissionDocument, event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!selected) return;
    const validationError = validateCandidateFile(selected);
    if (validationError) {
      setError(validationError);
      return;
    }
    void mutate(async () => {
      const contentBase64 = await fileToBase64(selected);
      const created = await candidateApi<{ id: string }>('/careers/candidate/documents', {
        method: 'POST',
        json: {
          kind: ['EDUCATION', 'CERTIFICATE'].includes(item.kind) ? 'CERTIFICATE' : 'OTHER',
          fileName: selected.name,
          mimeType: uploadMimeType(selected),
          contentBase64,
        },
      });
      await candidateApi(`/careers/candidate/pre-admission-documents/${item.id}/submit`, { method: 'POST', json: { candidateDocumentId: created.id } });
    });
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    const validationError = validateCandidateFile(selected);
    if (validationError) {
      setError(validationError);
      setFile(null);
      event.target.value = '';
      return;
    }
    setError(null);
    setFile(selected);
  }

  if (!token) {
    return (
      <AuthScreen
        mode={authMode}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthMessage(null);
          setAuthError(null);
        }}
        form={authForm}
        onFormChange={(patch) => setAuthForm((current) => ({ ...current, ...patch }))}
        onSubmit={submitAuth}
        onRequestReset={requestReset}
        loading={authLoading}
        message={authMessage}
        errorMessage={authError}
        vacanciesHref={vacanciesHref}
        returnTo={`/candidato${publicSuffix}`}
      />
    );
  }

  const data: PortalData = { profile, applications, documents, dataRequests, offers, preAdmissions };
  const counters = portalCounters(data);
  const badgeFor: Partial<Record<PortalTab, number>> = {
    candidaturas: counters.applicationsBadge,
    documentos: 0,
    privacidade: counters.openDataRequests,
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
            {initials(profile?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{profile?.name ?? 'Área do candidato'}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile?.email ?? 'Carregando…'}</p>
          </div>
          <Link href={vacanciesHref} className="hidden sm:block">
            <Button variant="secondary" size="sm">
              <BriefcaseBusiness className="h-3.5 w-3.5" /> Vagas
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={logout}>
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>

        <nav className="mx-auto max-w-5xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex min-w-max gap-1 pb-px">
            {PORTAL_TABS.map((item) => {
              const active = tab === item.id;
              const badge = badgeFor[item.id] ?? 0;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                        : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {badge > 0 && (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{badge}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="shrink-0 font-semibold hover:underline">Fechar</button>
          </div>
        )}
        {loading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" /> Carregando seus dados…
          </div>
        )}

        {tab === 'inicio' && <OverviewSection data={data} onNavigate={setTab} vacanciesHref={vacanciesHref} />}

        {tab === 'candidaturas' && (
          <ApplicationsSection
            applications={applications}
            offers={offers}
            preAdmissions={preAdmissions}
            documents={documents}
            busy={busy}
            vacanciesHref={vacanciesHref}
            publicSuffix={publicSuffix}
            onWithdraw={withdraw}
            onDecideOffer={decideOffer}
            onAttachPreAdmissionFile={attachPreAdmissionFile}
            onSelectExistingDocument={submitPreAdmissionDocument}
          />
        )}

        {tab === 'perfil' && (
          <ProfileSection
            profile={profile}
            profileForm={profileForm}
            professionalForm={professionalForm}
            onProfileChange={(patch) => setProfileForm((current) => ({ ...current, ...patch }))}
            onProfessionalChange={(patch) => setProfessionalForm((current) => ({ ...current, ...patch }))}
            onSave={saveProfile}
            busy={busy}
            saved={savedAt > 0}
          />
        )}

        {tab === 'documentos' && (
          <DocumentsSection
            documents={documents}
            applications={applications}
            file={file}
            uploadForm={uploadForm}
            busy={busy}
            onPickFile={pickFile}
            onUploadFormChange={(patch) => setUploadForm((current) => ({ ...current, ...patch }))}
            onUpload={uploadDocument}
            onDownload={downloadDocument}
            onDelete={deleteDocument}
          />
        )}

        {tab === 'privacidade' && (
          <PrivacySection
            dataRequests={dataRequests}
            form={dataRequestForm}
            busy={busy}
            onFormChange={(patch) => setDataRequestForm((current) => ({ ...current, ...patch }))}
            onSubmit={createDataRequest}
          />
        )}
      </div>
    </main>
  );
}

function authEndpoint(mode: AuthMode, suffix: string): string {
  if (mode === 'register') return `/careers/candidates/register${suffix}`;
  if (mode === 'reset') return '/careers/candidates/reset-password';
  return `/careers/candidates/login${suffix}`;
}

function toProfessionalForm(data: CandidateProfileData | null | undefined): ProfessionalForm {
  const value = data ?? {};
  return {
    about: String(value.about ?? ''),
    availableForRelocation: value.availableForRelocation === true,
    availableForTravel: value.availableForTravel === true,
    desiredSalary: String(value.desiredSalary ?? ''),
    availabilityToStart: String(value.availabilityToStart ?? ''),
    skills: Array.isArray(value.skills) ? value.skills.join(', ') : '',
    experiences: Array.isArray(value.experiences)
      ? value.experiences.map((item) => ({
          role: String(item.role ?? ''),
          company: String(item.company ?? ''),
          period: String(item.period ?? ''),
          description: String(item.description ?? ''),
        }))
      : [],
    education: Array.isArray(value.education)
      ? value.education.map((item) => ({
          course: String(item.course ?? ''),
          institution: String(item.institution ?? ''),
          period: String(item.period ?? ''),
          status: String(item.status ?? ''),
        }))
      : [],
    languages: Array.isArray(value.languages) ? value.languages.map((item) => ({ name: String(item.name ?? ''), level: String(item.level ?? '') })) : [],
  };
}

function splitSkills(value: string): string[] {
  return [...new Set(value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

const UPLOAD_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

function uploadMimeType(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return UPLOAD_MIME_BY_EXTENSION[extension] ?? file.type;
}

function validateCandidateFile(file: File): string | null {
  const mimeType = uploadMimeType(file);
  if (!Object.values(UPLOAD_MIME_BY_EXTENSION).includes(mimeType)) return 'Tipo de arquivo não permitido. Envie PDF, DOC, DOCX, PNG ou JPG.';
  if (file.size <= 0) return 'O arquivo selecionado está vazio.';
  if (file.size > MAX_UPLOAD_BYTES) return 'O arquivo ultrapassa o limite de 8 MB.';
  return null;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo.'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.readAsDataURL(file);
  });
}

function downloadBase64(doc: StoredContent) {
  const bytes = Uint8Array.from(atob(doc.contentBase64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: doc.mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.fileName;
  a.click();
  URL.revokeObjectURL(url);
}
