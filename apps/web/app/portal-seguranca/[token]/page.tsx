'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, CalendarClock, FileText, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrandMark } from '@/components/brand/brand-mark';
import { formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

type Invite = {
  token: string;
  expiresAt: string;
  requesterName?: string | null;
  authorization?: {
    code?: string | null;
    status?: string | null;
    reason?: string | null;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    allowedPeriodText?: string | null;
    notes?: string | null;
  } | null;
  responseData?: Record<string, unknown> | null;
};

type FormState = {
  visitorName: string;
  documentNumber: string;
  phone: string;
  email: string;
  originCompanyName: string;
  vehiclePlate: string;
  vehicleModel: string;
  companions: string;
  materialsDescription: string;
  documentEvidence: string;
  notes: string;
  acceptedTerms: boolean;
  privacyAccepted: boolean;
};

const emptyForm: FormState = {
  visitorName: '',
  documentNumber: '',
  phone: '',
  email: '',
  originCompanyName: '',
  vehiclePlate: '',
  vehicleModel: '',
  companions: '',
  materialsDescription: '',
  documentEvidence: '',
  notes: '',
  acceptedTerms: false,
  privacyAccepted: false,
};

export default function SecurityPortalInvitePage() {
  const params = useParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const invite = useQuery<Invite>({
    queryKey: ['asset-security-external', token],
    queryFn: () => externalApi<Invite>(`/asset-security/external/${token}`),
    enabled: Boolean(token),
    retry: false,
  });
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (invite.data) setForm(mergeInviteForm(invite.data));
  }, [invite.data]);

  const submit = useMutation({
    mutationFn: () =>
      externalApi(`/asset-security/external/${token}`, {
        method: 'PATCH',
        body: JSON.stringify({
          acceptedTerms: form.acceptedTerms,
          privacyAccepted: form.privacyAccepted,
          responseData: {
            visitorName: form.visitorName,
            documentNumber: form.documentNumber,
            phone: form.phone,
            email: form.email,
            originCompanyName: form.originCompanyName,
            vehiclePlate: form.vehiclePlate,
            vehicleModel: form.vehicleModel,
            companions: form.companions,
            materialsDescription: form.materialsDescription,
            documentEvidence: form.documentEvidence,
            notes: form.notes,
            submittedFrom: 'portal-seguranca',
          },
        }),
      }),
    onSuccess: () => {
      toast.success('Dados enviados para validação da portaria.');
      void invite.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Não foi possível enviar os dados.'),
  });

  const canSubmit = Boolean(form.visitorName.trim() && form.documentNumber.trim() && form.acceptedTerms && form.privacyAccepted);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 md:px-8">
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="text-sm font-semibold">Gestão 360</p>
              <p className="text-xs text-muted-foreground">Portal externo de segurança patrimonial</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Convite seguro</Badge>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Pré-cadastro de acesso</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Envie seus dados para agilizar a validação documental e a liberação na portaria.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Autorização</CardTitle>
                <CardDescription>Dados recebidos da empresa solicitante.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {invite.isLoading ? (
                  <p className="text-muted-foreground">Carregando convite...</p>
                ) : invite.isError ? (
                  <p className="text-destructive">Convite expirado, removido ou inválido.</p>
                ) : (
                  <>
                    <Info icon={BadgeCheck} label="Código" value={invite.data?.authorization?.code ?? invite.data?.token} />
                    <Info icon={CalendarClock} label="Validade" value={formatDate(invite.data?.expiresAt)} />
                    <Info icon={FileText} label="Motivo" value={invite.data?.authorization?.reason ?? 'Acesso autorizado'} />
                    <Info icon={CalendarClock} label="Período" value={periodText(invite.data)} />
                    {invite.data?.requesterName ? <Info icon={ShieldCheck} label="Solicitante" value={invite.data.requesterName} /> : null}
                  </>
                )}
              </CardContent>
            </Card>
          </aside>

          <Card>
            <CardHeader>
              <CardTitle>Dados do visitante, prestador ou motorista</CardTitle>
              <CardDescription>Campos obrigatórios são marcados com asterisco.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (canSubmit) submit.mutate(); }}>
                <Field required label="Nome completo" value={form.visitorName} onChange={(value) => setFormValue(setForm, 'visitorName', value)} />
                <Field required label="Documento" value={form.documentNumber} onChange={(value) => setFormValue(setForm, 'documentNumber', value)} />
                <Field label="Telefone" value={form.phone} onChange={(value) => setFormValue(setForm, 'phone', value)} />
                <Field label="E-mail" value={form.email} onChange={(value) => setFormValue(setForm, 'email', value)} />
                <Field label="Empresa de origem" value={form.originCompanyName} onChange={(value) => setFormValue(setForm, 'originCompanyName', value)} />
                <Field label="Placa do veículo" value={form.vehiclePlate} onChange={(value) => setFormValue(setForm, 'vehiclePlate', value.toUpperCase())} />
                <Field label="Modelo do veículo" value={form.vehicleModel} onChange={(value) => setFormValue(setForm, 'vehicleModel', value)} />
                <Field label="Acompanhantes" value={form.companions} onChange={(value) => setFormValue(setForm, 'companions', value)} />
                <LongField label="Materiais, ferramentas ou cargas" value={form.materialsDescription} onChange={(value) => setFormValue(setForm, 'materialsDescription', value)} />
                <LongField label="Documentos/evidências enviados" value={form.documentEvidence} onChange={(value) => setFormValue(setForm, 'documentEvidence', value)} />
                <LongField label="Observações" value={form.notes} onChange={(value) => setFormValue(setForm, 'notes', value)} />

                <label className="flex gap-3 text-sm md:col-span-2">
                  <input className="mt-1 h-4 w-4" type="checkbox" checked={form.acceptedTerms} onChange={(event) => setFormValue(setForm, 'acceptedTerms', event.target.checked)} />
                  <span>Confirmo que as informações enviadas são verdadeiras e aceito as regras de acesso da unidade.</span>
                </label>
                <label className="flex gap-3 text-sm md:col-span-2">
                  <input className="mt-1 h-4 w-4" type="checkbox" checked={form.privacyAccepted} onChange={(event) => setFormValue(setForm, 'privacyAccepted', event.target.checked)} />
                  <span>Autorizo o tratamento dos dados informados para fins de segurança patrimonial, controle de acesso e auditoria.</span>
                </label>

                <div className="flex flex-col gap-3 border-t pt-4 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">A portaria pode solicitar documento físico e validações adicionais no momento da entrada.</p>
                  <Button type="submit" disabled={!canSubmit || submit.isPending || invite.isError}>
                    {submit.isPending ? 'Enviando...' : 'Enviar pré-cadastro'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

async function externalApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : `Erro ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

function Field({ label, value, required, onChange }: { label: string; value: string; required?: boolean; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className={required ? 'field-required' : ''}>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function LongField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="md:col-span-2">
      <Label>{label}</Label>
      <Textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 border-t pt-3 first:border-t-0 first:pt-0">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium">{value || '-'}</p>
      </div>
    </div>
  );
}

function mergeInviteForm(invite?: Invite): FormState {
  const response = invite?.responseData ?? {};
  return {
    ...emptyForm,
    visitorName: text(response.visitorName),
    documentNumber: text(response.documentNumber),
    phone: text(response.phone),
    email: text(response.email),
    originCompanyName: text(response.originCompanyName),
    vehiclePlate: text(response.vehiclePlate),
    vehicleModel: text(response.vehicleModel),
    companions: text(response.companions),
    materialsDescription: text(response.materialsDescription),
    documentEvidence: text(response.documentEvidence),
    notes: text(response.notes),
  };
}

function periodText(invite?: Invite) {
  if (invite?.authorization?.allowedPeriodText) return invite.authorization.allowedPeriodText;
  const start = invite?.authorization?.scheduledStartAt ? formatDate(invite.authorization.scheduledStartAt) : null;
  const end = invite?.authorization?.scheduledEndAt ? formatDate(invite.authorization.scheduledEndAt) : null;
  return [start, end].filter(Boolean).join(' até ') || 'Conforme autorização';
}

function setFormValue<K extends keyof FormState>(setForm: (updater: (prev: FormState) => FormState) => void, key: K, value: FormState[K]) {
  setForm((prev) => ({ ...prev, [key]: value }));
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function safeJson(textValue: string): unknown {
  try {
    return JSON.parse(textValue);
  } catch {
    return textValue;
  }
}
