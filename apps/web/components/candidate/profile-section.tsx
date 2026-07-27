'use client';

import { GraduationCap, Info, Languages, Loader2, Plus, Save, Trash2, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { profileCompletion } from '@/lib/candidate/progress';
import {
  EMPTY_EDUCATION,
  EMPTY_EXPERIENCE,
  EMPTY_LANGUAGE,
  type ProfessionalForm,
  type Profile,
  type ProfileForm,
} from '@/lib/candidate/types';
import { Button, Card, CardTitle, Field, ProgressRing, Select, TextArea } from './ui';

/**
 * Perfil do candidato: dados de contato e o material que a empresa lê na
 * triagem.
 *
 * O botão de salvar é um só e fica fixo no rodapé da aba — antes ele aparecia
 * duas vezes na mesma coluna e não ficava claro o que cada um gravava (os dois
 * gravavam tudo).
 */
export function ProfileSection({
  profile,
  profileForm,
  professionalForm,
  onProfileChange,
  onProfessionalChange,
  onSave,
  busy,
  saved,
}: {
  profile: Profile | null;
  profileForm: ProfileForm;
  professionalForm: ProfessionalForm;
  onProfileChange: (patch: Partial<ProfileForm>) => void;
  onProfessionalChange: (patch: Partial<ProfessionalForm>) => void;
  onSave: () => void;
  busy: boolean;
  saved: boolean;
}) {
  const completion = profileCompletion(profile);

  return (
    <div className="space-y-5 pb-24">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <ProgressRing percent={completion.percent} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              {completion.percent === 100 ? 'Perfil completo' : 'Complete seu perfil'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {completion.percent === 100
                ? 'Mantenha as informações atualizadas a cada nova experiência.'
                : `Falta preencher: ${completion.missing.join(', ')}.`}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle title="Dados de contato" hint="É por aqui que o recrutador fala com você." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" value={profileForm.name} onChange={(name) => onProfileChange({ name })} required />
          <Field label="Telefone / WhatsApp" value={profileForm.phone} onChange={(phone) => onProfileChange({ phone })} placeholder="(00) 00000-0000" />
          <Field label="Cidade" value={profileForm.city} onChange={(city) => onProfileChange({ city })} placeholder="Cidade e estado" />
          <Field
            label="Título profissional"
            value={profileForm.headline}
            onChange={(headline) => onProfileChange({ headline })}
            placeholder="Ex.: Gestor administrativo"
            hint="Uma linha que resume o que você faz."
          />
          <Field label="LinkedIn" value={profileForm.linkedinUrl} onChange={(linkedinUrl) => onProfileChange({ linkedinUrl })} placeholder="https://linkedin.com/in/…" />
          <Field label="Portfólio ou site" value={profileForm.portfolioUrl} onChange={(portfolioUrl) => onProfileChange({ portfolioUrl })} placeholder="https://…" />
        </div>
        {profile?.email && (
          <p className="mt-4 text-xs text-slate-400">
            E-mail da conta: <span className="font-medium text-slate-600 dark:text-slate-300">{profile.email}</span>
            {profile.emailVerifiedAt ? ' · verificado' : ''}
          </p>
        )}
      </Card>

      <Card>
        <CardTitle title="Sua trajetória" hint="Este é o conteúdo que a empresa compara com os requisitos da vaga." />
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-xl bg-sky-50 p-3.5 text-xs leading-relaxed text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Estas informações ajudam a empresa e a IA de apoio a comparar sua experiência com os requisitos da vaga. A decisão final é sempre humana.
          </p>
          <TextArea
            label="Sobre sua trajetória profissional"
            value={professionalForm.about}
            onChange={(about) => onProfessionalChange({ about })}
            placeholder="Conte brevemente sua experiência, principais resultados e objetivo profissional."
          />
          <Field
            label="Habilidades"
            value={professionalForm.skills}
            onChange={(skills) => onProfessionalChange({ skills })}
            placeholder="Excel avançado, gestão de equipe, SAP…"
            hint="Separe por vírgulas."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Disponibilidade para iniciar"
              value={professionalForm.availabilityToStart}
              onChange={(availabilityToStart) => onProfessionalChange({ availabilityToStart })}
              placeholder="Imediata, 30 dias…"
            />
            <Field
              label="Pretensão salarial"
              value={professionalForm.desiredSalary}
              onChange={(desiredSalary) => onProfessionalChange({ desiredSalary })}
              placeholder="Opcional"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              checked={professionalForm.availableForRelocation}
              onChange={(availableForRelocation) => onProfessionalChange({ availableForRelocation })}
              label="Tenho disponibilidade para mudança"
            />
            <Toggle
              checked={professionalForm.availableForTravel}
              onChange={(availableForTravel) => onProfessionalChange({ availableForTravel })}
              label="Tenho disponibilidade para viagens"
            />
          </div>
        </div>
      </Card>

      <Card>
        <ListHeader
          icon={<Wand2 className="h-4 w-4" />}
          title="Experiências"
          hint="Comece pela mais recente."
          onAdd={() => onProfessionalChange({ experiences: [...professionalForm.experiences, { ...EMPTY_EXPERIENCE }] })}
        />
        {professionalForm.experiences.length === 0 ? (
          <ListEmpty text="Adicione seus cargos e experiências mais relevantes." />
        ) : (
          <div className="space-y-3">
            {professionalForm.experiences.map((item, index) => (
              <ListItem
                key={`experience-${index}`}
                onRemove={() => onProfessionalChange({ experiences: professionalForm.experiences.filter((_, i) => i !== index) })}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cargo / função" value={item.role} onChange={(role) => onProfessionalChange({ experiences: updateAt(professionalForm.experiences, index, { role }) })} />
                  <Field label="Empresa" value={item.company} onChange={(company) => onProfessionalChange({ experiences: updateAt(professionalForm.experiences, index, { company }) })} />
                </div>
                <Field label="Período" value={item.period} onChange={(period) => onProfessionalChange({ experiences: updateAt(professionalForm.experiences, index, { period }) })} placeholder="Jan/2020 – atual" />
                <TextArea
                  label="Atividades e resultados"
                  rows={3}
                  value={item.description}
                  onChange={(description) => onProfessionalChange({ experiences: updateAt(professionalForm.experiences, index, { description }) })}
                />
              </ListItem>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <ListHeader
          icon={<GraduationCap className="h-4 w-4" />}
          title="Formação"
          onAdd={() => onProfessionalChange({ education: [...professionalForm.education, { ...EMPTY_EDUCATION }] })}
        />
        {professionalForm.education.length === 0 ? (
          <ListEmpty text="Adicione cursos técnicos, graduação, pós-graduação ou outras formações relevantes." />
        ) : (
          <div className="space-y-3">
            {professionalForm.education.map((item, index) => (
              <ListItem
                key={`education-${index}`}
                onRemove={() => onProfessionalChange({ education: professionalForm.education.filter((_, i) => i !== index) })}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Curso" value={item.course} onChange={(course) => onProfessionalChange({ education: updateAt(professionalForm.education, index, { course }) })} />
                  <Field label="Instituição" value={item.institution} onChange={(institution) => onProfessionalChange({ education: updateAt(professionalForm.education, index, { institution }) })} />
                  <Field label="Período" value={item.period} onChange={(period) => onProfessionalChange({ education: updateAt(professionalForm.education, index, { period }) })} />
                  <Select label="Situação" value={item.status} onChange={(value) => onProfessionalChange({ education: updateAt(professionalForm.education, index, { status: value }) })}>
                    <option value="">Selecione…</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Trancado">Trancado</option>
                    <option value="Incompleto">Incompleto</option>
                  </Select>
                </div>
              </ListItem>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <ListHeader
          icon={<Languages className="h-4 w-4" />}
          title="Idiomas"
          onAdd={() => onProfessionalChange({ languages: [...professionalForm.languages, { ...EMPTY_LANGUAGE }] })}
        />
        {professionalForm.languages.length === 0 ? (
          <ListEmpty text="Informe idiomas e o nível de domínio." />
        ) : (
          <div className="space-y-3">
            {professionalForm.languages.map((item, index) => (
              <ListItem
                key={`language-${index}`}
                onRemove={() => onProfessionalChange({ languages: professionalForm.languages.filter((_, i) => i !== index) })}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Idioma" value={item.name} onChange={(name) => onProfessionalChange({ languages: updateAt(professionalForm.languages, index, { name }) })} />
                  <Select label="Nível" value={item.level} onChange={(level) => onProfessionalChange({ languages: updateAt(professionalForm.languages, index, { level }) })}>
                    <option value="">Selecione…</option>
                    <option value="Básico">Básico</option>
                    <option value="Intermediário">Intermediário</option>
                    <option value="Avançado">Avançado</option>
                    <option value="Fluente">Fluente</option>
                    <option value="Nativo">Nativo</option>
                  </Select>
                </div>
              </ListItem>
            ))}
          </div>
        )}
      </Card>

      {/* Barra fixa: a aba é longa e o candidato não deve rolar até o fim para
          descobrir onde salva. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          {saved && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Perfil salvo.</span>}
          <Button onClick={onSave} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar perfil
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      />
      {label}
    </label>
  );
}

function ListHeader({ icon, title, hint, onAdd }: { icon: ReactNode; title: string; hint?: string; onAdd: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
          <span className="text-slate-400">{icon}</span>
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      <Button variant="secondary" size="sm" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" /> Adicionar
      </Button>
    </div>
  );
}

function ListItem({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="relative space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover item"
        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

function ListEmpty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-700">{text}</p>;
}

function updateAt<T extends object>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}
