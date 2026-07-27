'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Monitor,
  Send,
  Smartphone,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ImageUploadButton, FileUploadButton } from '@/components/communication/media-uploader';
import { CategoryChip, CoverImage } from '@/components/communication/publication-bits';
import {
  LAYOUT_OPTIONS,
  presetForLayout,
  toDateTimeLocal,
  toggleId,
  type AudienceKind,
  type AudienceOptions,
  type AudienceSelection,
  type MediaAsset,
  type Publication,
  type PublicationCategory,
  type PublicationLayout,
} from '@/lib/communication/publications';

interface FormState {
  title: string;
  summary: string;
  content: string;
  categoryId: string;
  layout: PublicationLayout;
  coverImageUrl: string;
  coverImageAlt: string;
  galleryMediaIds: string[];
  attachmentMediaIds: string[];
  audience: AudienceSelection[];
  publishMode: 'now' | 'schedule' | 'draft';
  publishAt: string;
  expiresAt: string;
  isFeatured: boolean;
  isPinned: boolean;
  isImportant: boolean;
  requiresReadConfirmation: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  allowAttachmentDownload: boolean;
  showInEmployeeFeed: boolean;
  actionLabel: string;
  actionUrl: string;
  actionNewTab: boolean;
}

const EMPTY: FormState = {
  title: '',
  summary: '',
  content: '',
  categoryId: '',
  layout: 'IMAGE_TEXT',
  coverImageUrl: '',
  coverImageAlt: '',
  galleryMediaIds: [],
  attachmentMediaIds: [],
  audience: [{ kind: 'ALL', refId: null }],
  publishMode: 'now',
  publishAt: '',
  expiresAt: '',
  isFeatured: false,
  isPinned: false,
  isImportant: false,
  requiresReadConfirmation: false,
  notifyInApp: true,
  notifyEmail: false,
  allowAttachmentDownload: true,
  showInEmployeeFeed: true,
  actionLabel: '',
  actionUrl: '',
  actionNewTab: false,
};

const STEPS = [
  { id: 1, label: 'Conteúdo' },
  { id: 2, label: 'Aparência' },
  { id: 3, label: 'Público' },
  { id: 4, label: 'Publicação' },
];

/** Criação e edição de publicação — mesma tela em 4 etapas. */
export function PublicationForm({ publication }: { publication?: Publication }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [preview, setPreview] = useState<'desktop' | 'mobile'>('desktop');

  const categories = useQuery<PublicationCategory[]>({
    queryKey: ['communication-categories'],
    queryFn: () => api('/communication/settings/categories'),
  });
  const audienceOptions = useQuery<AudienceOptions>({
    queryKey: ['communication-audience-options'],
    queryFn: () => api('/communication/publications/audience/options'),
  });
  const settings = useQuery<{ settings: { approvalRequired: boolean } }>({
    queryKey: ['communication-settings'],
    queryFn: () => api('/communication/settings'),
  });
  const media = useQuery<{ items: MediaAsset[] }>({
    queryKey: ['communication-media-picker'],
    queryFn: () => api('/communication/media'),
  });

  const approvalRequired = settings.data?.settings.approvalRequired ?? false;

  // Carrega a publicação em edição e semeia a categoria padrão na criação.
  useEffect(() => {
    if (publication) {
      setForm({
        title: publication.title,
        summary: publication.summary ?? '',
        content: publication.content ?? '',
        categoryId: publication.categoryId ?? '',
        layout: publication.layout,
        coverImageUrl: publication.coverImageUrl ?? '',
        coverImageAlt: publication.coverImageAlt ?? '',
        galleryMediaIds: publication.gallery.map((item) => item.id),
        attachmentMediaIds: publication.attachments.map((item) => item.id),
        audience: publication.audience.length > 0 ? publication.audience : [{ kind: 'ALL', refId: null }],
        publishMode: publication.status === 'SCHEDULED' ? 'schedule' : 'draft',
        publishAt: toDateTimeLocal(publication.publishAt),
        expiresAt: toDateTimeLocal(publication.expiresAt),
        isFeatured: publication.isFeatured,
        isPinned: publication.isPinned,
        isImportant: publication.isImportant,
        requiresReadConfirmation: publication.requiresReadConfirmation,
        notifyInApp: publication.notifyInApp,
        notifyEmail: publication.notifyEmail,
        allowAttachmentDownload: publication.allowAttachmentDownload,
        showInEmployeeFeed: publication.showInEmployeeFeed,
        actionLabel: publication.actionLabel ?? '',
        actionUrl: publication.actionUrl ?? '',
        actionNewTab: publication.actionNewTab,
      });
    }
  }, [publication]);

  useEffect(() => {
    if (!form.categoryId && categories.data?.length) {
      setForm((current) => ({ ...current, categoryId: categories.data![0]!.id }));
    }
  }, [categories.data, form.categoryId]);

  const estimate = useQuery<{ count: number }>({
    queryKey: ['communication-audience-estimate', JSON.stringify(form.audience)],
    queryFn: () => api('/communication/publications/audience/estimate', { method: 'POST', json: { audience: form.audience } }),
    enabled: form.audience.length > 0,
  });

  const payload = useMemo(
    () => ({
      title: form.title,
      summary: form.summary,
      content: form.content,
      categoryId: form.categoryId || null,
      layout: form.layout,
      coverImageUrl: form.layout === 'TEXT_ONLY' ? null : form.coverImageUrl || null,
      coverImageAlt: form.coverImageAlt || null,
      galleryMediaIds: form.layout === 'GALLERY' ? form.galleryMediaIds : [],
      attachmentMediaIds: form.attachmentMediaIds,
      audience: form.audience,
      publishAt: form.publishMode === 'schedule' ? form.publishAt || null : null,
      expiresAt: form.expiresAt || null,
      isFeatured: form.isFeatured,
      isPinned: form.isPinned,
      isImportant: form.isImportant,
      requiresReadConfirmation: form.requiresReadConfirmation,
      notifyInApp: form.notifyInApp,
      notifyEmail: form.notifyEmail,
      allowAttachmentDownload: form.allowAttachmentDownload,
      showInEmployeeFeed: form.showInEmployeeFeed,
      actionLabel: form.actionLabel || null,
      actionUrl: form.actionUrl || null,
      actionNewTab: form.actionNewTab,
    }),
    [form],
  );

  const save = useMutation({
    mutationFn: async (mode: 'draft' | 'publish') => {
      const saved = publication
        ? await api<Publication>(`/communication/publications/${publication.id}`, { method: 'PATCH', json: payload })
        : await api<Publication>('/communication/publications', { method: 'POST', json: payload });

      if (mode === 'publish') {
        // Com aprovação ligada, o autor envia para revisão em vez de publicar.
        const next = approvalRequired ? 'PENDING_APPROVAL' : form.publishMode === 'schedule' ? 'SCHEDULED' : 'PUBLISHED';
        await api(`/communication/publications/${saved.id}/status`, {
          method: 'POST',
          json: { status: next, publishAt: form.publishAt || undefined },
        });
      }
      return saved;
    },
    onSuccess: (saved, mode) => {
      void qc.invalidateQueries({ queryKey: ['communication-publications'] });
      void qc.invalidateQueries({ queryKey: ['communication-overview'] });
      toast.success(
        mode === 'draft'
          ? 'Rascunho salvo.'
          : approvalRequired
            ? 'Publicação enviada para aprovação.'
            : form.publishMode === 'schedule'
              ? 'Publicação programada.'
              : 'Publicação divulgada aos colaboradores.',
      );
      router.push(`/comunicacao/publicacoes/${saved.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stepValid: Record<number, boolean> = {
    1: Boolean(form.title.trim() && form.content.trim() && form.categoryId),
    2: form.layout !== 'GALLERY' || form.galleryMediaIds.length > 0,
    3: form.audience.length > 0,
    4: form.publishMode !== 'schedule' || Boolean(form.publishAt),
  };
  const canSubmit = stepValid[1] && stepValid[2] && stepValid[3] && stepValid[4];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Stepper step={step} onStep={setStep} valid={stepValid} />

        {step === 1 && (
          <StepContent
            form={form}
            setForm={setForm}
            categories={categories.data ?? []}
            attachments={(media.data?.items ?? []).filter((item) => ['PDF', 'DOCUMENT', 'VIDEO'].includes(item.type))}
          />
        )}
        {step === 2 && <StepAppearance form={form} setForm={setForm} media={media.data?.items ?? []} />}
        {step === 3 && (
          <StepAudience form={form} setForm={setForm} options={audienceOptions.data} estimate={estimate.data?.count} />
        )}
        {step === 4 && <StepPublish form={form} setForm={setForm} approvalRequired={approvalRequired} />}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => save.mutate('draft')} disabled={!stepValid[1] || save.isPending}>
              Salvar rascunho
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={!stepValid[step]}>
                Continuar
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => save.mutate('publish')} disabled={!canSubmit || save.isPending}>
                <Send className="mr-1.5 h-4 w-4" />
                {approvalRequired
                  ? 'Enviar para aprovação'
                  : form.publishMode === 'schedule'
                    ? 'Programar publicação'
                    : 'Publicar agora'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <PreviewPanel form={form} categories={categories.data ?? []} device={preview} onDevice={setPreview} />
    </div>
  );
}

// -------------------------------------------------------------------- passos

function Stepper({
  step,
  onStep,
  valid,
}: {
  step: number;
  onStep: (step: number) => void;
  valid: Record<number, boolean>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((item) => {
        const active = item.id === step;
        const done = item.id < step && valid[item.id];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onStep(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
              active ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <span
              className={cn(
                'grid h-5 w-5 place-items-center rounded-full text-[11px]',
                done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {done ? <Check className="h-3 w-3" /> : item.id}
            </span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors hover:bg-muted/40">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function StepContent({
  form,
  setForm,
  categories,
  attachments,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  categories: PublicationCategory[];
  attachments: MediaAsset[];
}) {
  return (
    <div className="space-y-4">
      <Section title="Conteúdo" description="O que será comunicado aos colaboradores.">
        <Field label="Título da publicação">
          <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={160} />
        </Field>
        <Field label="Resumo ou chamada" hint="Aparece abaixo do título no feed. Opcional.">
          <Input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} maxLength={220} />
        </Field>
        <Field label="Texto completo">
          <Textarea rows={10} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
        </Field>
        <Field label="Categoria">
          <NativeSelect value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
            {categories.length === 0 && <option value="">Carregando...</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </Section>

      <Section title="Anexos" description="Documentos que o colaborador poderá baixar junto da publicação.">
        <div className="flex flex-wrap items-center gap-2">
          <FileUploadButton
            folder="Anexos"
            label="Enviar anexo"
            onUploaded={(item) => setForm((current) => ({ ...current, attachmentMediaIds: [...current.attachmentMediaIds, item.id] }))}
          />
          {attachments.length > 0 && (
            <NativeSelect
              className="w-auto"
              value=""
              onChange={(event) => {
                const id = event.target.value;
                if (id && !form.attachmentMediaIds.includes(id)) {
                  setForm({ ...form, attachmentMediaIds: [...form.attachmentMediaIds, id] });
                }
              }}
            >
              <option value="">Reutilizar da biblioteca...</option>
              {attachments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        {form.attachmentMediaIds.length > 0 && (
          <ul className="space-y-1.5">
            {form.attachmentMediaIds.map((id) => {
              const item = attachments.find((asset) => asset.id === id);
              return (
                <li key={id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{item?.name ?? 'Arquivo enviado'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive"
                    onClick={() => setForm({ ...form, attachmentMediaIds: form.attachmentMediaIds.filter((value) => value !== id) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function StepAppearance({
  form,
  setForm,
  media,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  media: MediaAsset[];
}) {
  const images = media.filter((item) => item.type === 'IMAGE' || item.type === 'BANNER');
  const preset = presetForLayout(form.layout);

  return (
    <div className="space-y-4">
      <Section title="Formato" description="Como a publicação será exibida no feed do colaborador.">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {LAYOUT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setForm({ ...form, layout: option.id })}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                form.layout === option.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-[11px] text-muted-foreground">{option.ratio}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
            </button>
          ))}
        </div>
      </Section>

      {form.layout !== 'TEXT_ONLY' && (
        <Section
          title={form.layout === 'GALLERY' ? 'Galeria de imagens' : 'Imagem principal'}
          description={`Tamanho recomendado: ${preset.width} × ${preset.height}px (${preset.label}). A ferramenta permite recortar na proporção certa.`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ImageUploadButton
              presetId={preset.id}
              folder="Publicações"
              label={form.layout === 'GALLERY' ? 'Adicionar imagem' : 'Enviar imagem'}
              onUploaded={(item) =>
                setForm((current) =>
                  current.layout === 'GALLERY'
                    ? { ...current, galleryMediaIds: [...current.galleryMediaIds, item.id] }
                    : { ...current, coverImageUrl: item.url ?? '' },
                )
              }
            />
            {images.length > 0 && (
              <NativeSelect
                className="w-auto"
                value=""
                onChange={(event) => {
                  const item = images.find((asset) => asset.id === event.target.value);
                  if (!item) return;
                  setForm((current) =>
                    current.layout === 'GALLERY'
                      ? { ...current, galleryMediaIds: toggleId(current.galleryMediaIds, item.id) }
                      : { ...current, coverImageUrl: item.url ?? '' },
                  );
                }}
              >
                <option value="">Reutilizar da biblioteca...</option>
                {images.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>

          {form.layout === 'GALLERY' ? (
            form.galleryMediaIds.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {form.galleryMediaIds.map((id) => {
                  const item = images.find((asset) => asset.id === id);
                  return (
                    <div key={id} className="group relative overflow-hidden rounded-md border">
                      <CoverImage url={item?.url} aspect="aspect-square" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, galleryMediaIds: form.galleryMediaIds.filter((value) => value !== id) })}
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remover imagem"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                Adicione ao menos uma imagem à galeria.
              </p>
            )
          ) : (
            form.coverImageUrl && (
              <div className="overflow-hidden rounded-md border">
                <CoverImage url={form.coverImageUrl} alt={form.coverImageAlt} aspect="aspect-[16/9]" />
              </div>
            )
          )}

          <Field label="Texto alternativo da imagem" hint="Descreve a imagem para leitores de tela (acessibilidade).">
            <Input
              value={form.coverImageAlt}
              onChange={(event) => setForm({ ...form, coverImageAlt: event.target.value })}
              maxLength={160}
            />
          </Field>
        </Section>
      )}
    </div>
  );
}

function StepAudience({
  form,
  setForm,
  options,
  estimate,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  options?: AudienceOptions;
  estimate?: number;
}) {
  const [tab, setTab] = useState<AudienceKind>('ORG_NODE');
  const isAll = form.audience.some((rule) => rule.kind === 'ALL');

  const toggleRule = (kind: AudienceKind, refId: string) => {
    setForm((current) => {
      const without = current.audience.filter((rule) => rule.kind !== 'ALL');
      const exists = without.some((rule) => rule.kind === kind && rule.refId === refId);
      const next = exists
        ? without.filter((rule) => !(rule.kind === kind && rule.refId === refId))
        : [...without, { kind, refId }];
      return { ...current, audience: next.length > 0 ? next : [{ kind: 'ALL' as AudienceKind, refId: null }] };
    });
  };

  const groups: Array<{ kind: AudienceKind; label: string; items: Array<{ id: string; name: string; detail?: string | null }> }> = [
    { kind: 'ORG_NODE', label: 'Unidade / Diretoria / Área / Setor', items: options?.orgNodes ?? [] },
    { kind: 'JOB', label: 'Cargo', items: options?.jobs ?? [] },
    { kind: 'ROLE', label: 'Grupo de colaboradores', items: options?.roles ?? [] },
    { kind: 'USER', label: 'Colaboradores específicos', items: options?.users ?? [] },
  ];
  const activeGroup = groups.find((group) => group.kind === tab)!;
  const [search, setSearch] = useState('');
  const filtered = activeGroup.items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Section title="Público" description="Quem vai receber esta publicação na Comunicação Interna.">
      <button
        type="button"
        onClick={() => setForm({ ...form, audience: [{ kind: 'ALL', refId: null }] })}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
          isAll ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
        )}
      >
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">Todos os colaboradores</span>
          <span className="block text-xs text-muted-foreground">Toda a empresa recebe a publicação</span>
        </span>
      </button>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <button
              key={group.kind}
              type="button"
              onClick={() => {
                setTab(group.kind);
                setSearch('');
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                tab === group.kind ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {group.label}
            </button>
          ))}
        </div>

        <Input placeholder="Buscar..." value={search} onChange={(event) => setSearch(event.target.value)} />

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            filtered.slice(0, 200).map((item) => {
              const selected = form.audience.some((rule) => rule.kind === tab && rule.refId === item.id);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <input type="checkbox" checked={selected} onChange={() => toggleRule(tab, item.id)} />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.detail && <span className="shrink-0 text-[11px] text-muted-foreground">{item.detail}</span>}
                </label>
              );
            })
          )}
        </div>
      </div>

      {!isAll && form.audience.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {form.audience.map((rule) => {
            const group = groups.find((item) => item.kind === rule.kind);
            const name = group?.items.find((item) => item.id === rule.refId)?.name ?? rule.refId;
            return (
              <Badge key={`${rule.kind}-${rule.refId}`} variant="secondary" className="gap-1.5">
                {name}
                <button type="button" onClick={() => toggleRule(rule.kind, rule.refId!)} aria-label="Remover">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span>
          <strong className="tabular-nums">{estimate ?? '—'}</strong> pessoa(s) receberão esta comunicação
        </span>
      </div>
    </Section>
  );
}

function StepPublish({
  form,
  setForm,
  approvalRequired,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  approvalRequired: boolean;
}) {
  return (
    <div className="space-y-4">
      <Section title="Quando publicar">
        {approvalRequired && (
          <p className="rounded-md border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            Esta empresa exige aprovação: a publicação será enviada ao aprovador antes de ir ao ar.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {(['now', 'schedule'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setForm({ ...form, publishMode: mode })}
              className={cn(
                'rounded-lg border p-3 text-left text-sm transition-colors',
                form.publishMode === mode ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-muted/40',
              )}
            >
              {mode === 'now' ? 'Publicar agora' : 'Agendar data e horário'}
            </button>
          ))}
        </div>
        {form.publishMode === 'schedule' && (
          <Field label="Publicar em">
            <Input
              type="datetime-local"
              value={form.publishAt}
              onChange={(event) => setForm({ ...form, publishAt: event.target.value })}
            />
          </Field>
        )}
        <Field label="Data de encerramento" hint="Ao chegar a data, a publicação sai do feed principal e do destaque.">
          <Input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
          />
        </Field>
      </Section>

      <Section title="Destaque e leitura">
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={form.isFeatured}
            onChange={(value) => setForm({ ...form, isFeatured: value })}
            label="Fixar como destaque"
            hint="Aparece no banner do topo da Comunicação Interna"
          />
          <Toggle
            checked={form.isPinned}
            onChange={(value) => setForm({ ...form, isPinned: value })}
            label="Exibir primeiro no banner"
            hint="Prioriza esta publicação entre os destaques"
          />
          <Toggle
            checked={form.isImportant}
            onChange={(value) => setForm({ ...form, isImportant: value })}
            label="Marcar como importante"
            hint="Recebe o selo 'Importante' no feed"
          />
          <Toggle
            checked={form.requiresReadConfirmation}
            onChange={(value) => setForm({ ...form, requiresReadConfirmation: value })}
            label="Exigir confirmação de leitura"
            hint="O colaborador precisa declarar ciência; entra no Meu Dia"
          />
        </div>
      </Section>

      <Section title="Envio e destino">
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={form.showInEmployeeFeed}
            onChange={(value) => setForm({ ...form, showInEmployeeFeed: value })}
            label="Exibir em Minha Vida Funcional > Comunicação Interna"
            hint="Destino padrão das publicações"
          />
          <Toggle
            checked={form.notifyInApp}
            onChange={(value) => setForm({ ...form, notifyInApp: value })}
            label="Enviar notificação interna"
            hint="Sino do portal e push, quando disponível"
          />
          <Toggle
            checked={form.notifyEmail}
            onChange={(value) => setForm({ ...form, notifyEmail: value })}
            label="Enviar aviso por e-mail"
            hint="Complementar; só dispara se marcado aqui"
          />
          <Toggle
            checked={form.allowAttachmentDownload}
            onChange={(value) => setForm({ ...form, allowAttachmentDownload: value })}
            label="Permitir download dos anexos"
          />
        </div>
      </Section>

      <Section title="Botão de ação" description="Opcional. Leva o colaborador a um documento, inscrição ou regulamento.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Texto do botão">
            <Input
              value={form.actionLabel}
              onChange={(event) => setForm({ ...form, actionLabel: event.target.value })}
              placeholder="Saiba mais"
              maxLength={40}
            />
          </Field>
          <Field label="Link" hint="Endereço completo (https://) ou caminho interno (/documents)">
            <Input value={form.actionUrl} onChange={(event) => setForm({ ...form, actionUrl: event.target.value })} />
          </Field>
        </div>
        <Toggle
          checked={form.actionNewTab}
          onChange={(value) => setForm({ ...form, actionNewTab: value })}
          label="Abrir em nova aba"
        />
      </Section>
    </div>
  );
}

// ----------------------------------------------------------------- preview

function PreviewPanel({
  form,
  categories,
  device,
  onDevice,
}: {
  form: FormState;
  categories: PublicationCategory[];
  device: 'desktop' | 'mobile';
  onDevice: (device: 'desktop' | 'mobile') => void;
}) {
  const category = categories.find((item) => item.id === form.categoryId);
  const aspect =
    form.layout === 'BANNER_WIDE' ? 'aspect-[16/9]' : form.layout === 'FEED_CARD' ? 'aspect-[4/5]' : 'aspect-square';

  return (
    <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Eye className="h-4 w-4" />
          Pré-visualização
        </h3>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button variant={device === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => onDevice('desktop')}>
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button variant={device === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => onDevice('mobile')}>
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className={cn('mx-auto w-full transition-all', device === 'mobile' && 'max-w-[320px]')}>
        <Card className="overflow-hidden">
          {form.layout !== 'TEXT_ONLY' && <CoverImage url={form.coverImageUrl} alt={form.coverImageAlt} aspect={aspect} />}
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {category && <CategoryChip name={category.name} color={category.color} />}
              {form.isImportant && (
                <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                  Importante
                </span>
              )}
            </div>
            <p className="font-semibold leading-snug">{form.title || 'Título da publicação'}</p>
            {form.summary && <p className="text-sm text-muted-foreground">{form.summary}</p>}
            <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
              {form.content || 'O texto do comunicado aparece aqui.'}
            </p>
            {form.actionLabel && form.actionUrl && (
              <Button variant="outline" size="sm" className="mt-1 w-full" type="button">
                {form.actionLabel}
              </Button>
            )}
            {form.requiresReadConfirmation && (
              <div className="rounded-md border border-violet-300/60 bg-violet-500/8 px-3 py-2 text-[11px] text-violet-700 dark:text-violet-300">
                Confirmo que li e estou ciente deste comunicado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {device === 'desktop' ? 'Como aparece no computador' : 'Como aparece no celular'}
      </p>
    </div>
  );
}
