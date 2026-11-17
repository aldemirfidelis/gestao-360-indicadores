'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, Copy, Database, Download, Edit, FileUp, Layers, Library, Loader2, Plus, RefreshCw, Save, Server, Star, Trash2, Users, Wrench } from 'lucide-react';
import { markdownToDoc } from '@g360/shared';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';
import { downloadProtected } from './files';
import { StructuredViewer } from './structured-editor';
import { STATUS_LABEL, TYPE_LABEL, formatBytes, formatDateTime, type DocOptions, type DocStatus, type DocTemplate, type DocType, type TypeConfig } from './types';
import { EmptyState, Field, MultiSelect, errorMessage, invalidateDocuments, userOptions } from './ui';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      if (!base64) reject(new Error('Arquivo vazio.'));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha na leitura do arquivo.'));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------- tipos

interface TypeForm {
  name: string;
  sigla: string;
  prefix: string;
  category: DocType;
  digits: string;
  defaultValidityDays: string;
  alertDays: string;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  reviewDays: string;
  approvalDays: string;
  active: boolean;
}

const EMPTY_TYPE: TypeForm = { name: '', sigla: '', prefix: '', category: 'PROCEDURE', digits: '3', defaultValidityDays: '730', alertDays: '30', mode: 'SEQUENTIAL', reviewDays: '5', approvalDays: '5', active: true };

function TypesSection({ types }: { types: TypeConfig[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TypeConfig | 'new' | null>(null);
  const [form, setForm] = useState<TypeForm>(EMPTY_TYPE);
  const open = (type: TypeConfig | 'new') => {
    setEditing(type);
    setForm(
      type === 'new'
        ? EMPTY_TYPE
        : {
            name: type.name,
            sigla: type.sigla,
            prefix: type.prefix,
            category: type.category,
            digits: String(type.digits),
            defaultValidityDays: type.defaultValidityDays ? String(type.defaultValidityDays) : '',
            alertDays: String(type.alertDays),
            mode: type.approvalFlow?.mode ?? 'SEQUENTIAL',
            reviewDays: String(type.approvalFlow?.reviewDays ?? 5),
            approvalDays: String(type.approvalFlow?.approvalDays ?? 5),
            active: type.active,
          },
    );
  };
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        sigla: form.sigla.trim().toUpperCase(),
        prefix: (form.prefix || form.sigla).trim().toUpperCase(),
        category: form.category,
        digits: Number(form.digits) || 3,
        defaultValidityDays: form.defaultValidityDays ? Number(form.defaultValidityDays) : null,
        alertDays: Number(form.alertDays) || 30,
        active: form.active,
        approvalFlow: { mode: form.mode, reviewDays: Number(form.reviewDays) || 5, approvalDays: Number(form.approvalDays) || 5 },
      };
      return editing && editing !== 'new' ? api(`/documents/types/${editing.id}`, { method: 'PATCH', json: payload }) : api('/documents/types', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Tipo salvo.');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['documents', 'options'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const patch = (next: Partial<TypeForm>) => setForm((current) => ({ ...current, ...next }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Tipos de documento</CardTitle>
          <CardDescription>Sigla, numeração automática, validade padrão e fluxo de aprovação sugerido.</CardDescription>
        </div>
        <Button size="sm" onClick={() => open('new')}><Plus className="mr-1.5 h-4 w-4" />Novo tipo</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3">Sigla</th>
                <th className="py-2 pr-3">Nome</th>
                <th className="py-2 pr-3">Próximo código</th>
                <th className="py-2 pr-3">Validade</th>
                <th className="py-2 pr-3">Fluxo</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-semibold text-primary">{type.sigla}</td>
                  <td className="py-2 pr-3">
                    {type.name}
                    {!type.active && <Badge variant="outline" className="ml-2 text-muted-foreground">inativo</Badge>}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{type.prefix}-{String(type.nextNumber).padStart(type.digits, '0')}</td>
                  <td className="py-2 pr-3">{type.defaultValidityDays ? `${type.defaultValidityDays} dias` : '—'}</td>
                  <td className="py-2 pr-3 text-xs">{type.approvalFlow?.mode === 'PARALLEL' ? 'Ao mesmo tempo' : 'Em sequência'}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => open(type)}><Edit className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <Dialog open={Boolean(editing)} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Novo tipo de documento' : 'Editar tipo de documento'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2"><Input value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Ex.: Procedimento Operacional Padrão" /></Field>
            <Field label="Sigla"><Input value={form.sigla} onChange={(event) => patch({ sigla: event.target.value.toUpperCase().slice(0, 10) })} placeholder="POP" /></Field>
            <Field label="Prefixo do código"><Input value={form.prefix} onChange={(event) => patch({ prefix: event.target.value.toUpperCase().slice(0, 20) })} placeholder={form.sigla || 'POP'} /></Field>
            <Field label="Categoria">
              <NativeSelect value={form.category} onChange={(event) => patch({ category: event.target.value as DocType })}>
                {(Object.keys(TYPE_LABEL) as DocType[]).map((type) => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Dígitos da numeração"><Input type="number" min={1} max={8} value={form.digits} onChange={(event) => patch({ digits: event.target.value })} /></Field>
            <Field label="Validade padrão (dias)" hint="Em branco: sem vencimento."><Input type="number" min={1} value={form.defaultValidityDays} onChange={(event) => patch({ defaultValidityDays: event.target.value })} /></Field>
            <Field label="Avisar antes (dias)"><Input type="number" min={1} max={365} value={form.alertDays} onChange={(event) => patch({ alertDays: event.target.value })} /></Field>
            <Field label="Ordem das assinaturas">
              <NativeSelect value={form.mode} onChange={(event) => patch({ mode: event.target.value as TypeForm['mode'] })}>
                <option value="SEQUENTIAL">Em sequência</option>
                <option value="PARALLEL">Ao mesmo tempo</option>
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dias revisão"><Input type="number" min={1} max={60} value={form.reviewDays} onChange={(event) => patch({ reviewDays: event.target.value })} /></Field>
              <Field label="Dias aprovação"><Input type="number" min={1} max={60} value={form.approvalDays} onChange={(event) => patch({ approvalDays: event.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="h-4 w-4" checked={form.active} onChange={(event) => patch({ active: event.target.checked })} />
              Tipo ativo (aparece na criação de documentos)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={!form.name.trim() || !form.sigla.trim() || save.isPending} onClick={() => save.mutate()}><Save className="mr-1.5 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// -------------------------------------------------------------------- modelos

interface LibraryEntry { key: string; name: string; description: string; category: DocType; sigla?: string; preview: string; installed: boolean }

function TemplatesSection({ options }: { options: DocOptions }) {
  const qc = useQueryClient();
  const templates = useQuery<DocTemplate[]>({ queryKey: ['documents', 'templates'], queryFn: () => api<DocTemplate[]>('/documents/templates') });
  const [dialog, setDialog] = useState<{ template: DocTemplate | null } | null>(null);
  const [form, setForm] = useState({ name: '', typeConfigId: '', description: '', content: '', isDefault: false });
  const [preview, setPreview] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [importing, setImporting] = useState<{ fileName: string; base64: string } | null>(null);
  const [importForm, setImportForm] = useState({ name: '', typeConfigId: '', description: '' });
  const [reason, setReason] = useState<ReasonDialogState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const library = useQuery<LibraryEntry[]>({ queryKey: ['documents', 'templates', 'library'], queryFn: () => api<LibraryEntry[]>('/documents/templates/library'), enabled: galleryOpen });
  const typeName = (id: string | null) => options.typeConfigs.find((type) => type.id === id)?.sigla ?? 'Todos';
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['documents', 'templates'] });
    void qc.invalidateQueries({ queryKey: ['documents', 'options'] });
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), typeConfigId: form.typeConfigId || null, description: form.description.trim() || null, content: form.content || null, isDefault: form.isDefault };
      return dialog?.template ? api(`/documents/templates/${dialog.template.id}`, { method: 'PATCH', json: payload }) : api('/documents/templates', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Modelo salvo.');
      setDialog(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const patchTemplate = useMutation({
    mutationFn: ({ id, json }: { id: string; json: Record<string, unknown> }) => api(`/documents/templates/${id}`, { method: 'PATCH', json }),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => api(`/documents/templates/${id}/duplicate`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Modelo duplicado.');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/documents/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Modelo excluído.');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const importDocx = useMutation({
    mutationFn: () => api('/documents/templates/import', { method: 'POST', json: { name: importForm.name.trim(), typeConfigId: importForm.typeConfigId || null, description: importForm.description.trim() || null, fileName: importing?.fileName, contentBase64: importing?.base64 } }),
    onSuccess: () => {
      toast.success('Modelo Word importado.');
      setImporting(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const install = useMutation({
    mutationFn: (keys: string[]) => api<{ installed: unknown[]; skipped: string[] }>('/documents/templates/library/install', { method: 'POST', json: { keys } }),
    onSuccess: (result) => {
      toast.success(`${result.installed.length} modelo(s) adicionados.`);
      if (result.skipped.length) toast.message('Alguns já existiam', { description: result.skipped.join(', ') });
      setSelection([]);
      setGalleryOpen(false);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const pickFile = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Selecione um arquivo .docx.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('O modelo Word pode ter até 8 MB.');
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      setImportForm({ name: file.name.replace(/\.docx$/i, ''), typeConfigId: '', description: '' });
      setImporting({ fileName: file.name, base64 });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const previewDoc = useMemo(() => (preview ? markdownToDoc(form.content) : null), [preview, form.content]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Modelos</CardTitle>
          <CardDescription>A estrutura inicial dos documentos. Use {'{{codigo}}'}, {'{{titulo}}'}, {'{{area}}'} e outros campos automáticos.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setGalleryOpen(true)}><Library className="mr-1.5 h-4 w-4" />Galeria</Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="mr-1.5 h-4 w-4" />Importar Word</Button>
          <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={(event) => { void pickFile(event.target.files?.[0] ?? null); event.target.value = ''; }} />
          <Button size="sm" onClick={() => { setDialog({ template: null }); setForm({ name: '', typeConfigId: '', description: '', content: '', isDefault: false }); setPreview(false); }}>
            <Plus className="mr-1.5 h-4 w-4" />Novo modelo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {templates.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !(templates.data ?? []).length ? (
          <EmptyState icon={<Layers className="h-5 w-5" />} title="Nenhum modelo" description="Instale modelos prontos da galeria (POP, IT, procedimento, norma) ou importe um Word." />
        ) : (
          <ul className="divide-y">
            {(templates.data ?? []).map((template) => (
              <li key={template.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {template.name}
                    <Badge variant="outline" className="text-xs">{typeName(template.typeConfigId)}</Badge>
                    {template.isDefault && <Badge variant="outline" className="border-status-green/40 text-status-green">padrão</Badge>}
                    {!template.active && <Badge variant="outline" className="text-muted-foreground">inativo</Badge>}
                    {template.fileName && <Badge variant="outline" className="text-xs">Word</Badge>}
                  </p>
                  {template.description && <p className="truncate text-xs text-muted-foreground">{template.description}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" title="Editar" onClick={() => { setDialog({ template }); setForm({ name: template.name, typeConfigId: template.typeConfigId ?? '', description: template.description ?? '', content: template.content ?? '', isDefault: template.isDefault }); setPreview(false); }}><Edit className="h-4 w-4" /></Button>
                  {!template.isDefault && template.active && <Button size="sm" variant="ghost" title="Tornar padrão do tipo" onClick={() => patchTemplate.mutate({ id: template.id, json: { isDefault: true } })}><Star className="h-4 w-4" /></Button>}
                  <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicate.mutate(template.id)}><Copy className="h-4 w-4" /></Button>
                  {template.fileName && <Button size="sm" variant="ghost" title="Baixar Word" onClick={() => downloadProtected(`/documents/templates/${template.id}/download`, template.fileName?.endsWith('.docx') ? template.fileName : `${template.name}.docx`)}><Download className="h-4 w-4" /></Button>}
                  <Button size="sm" variant="ghost" title={template.active ? 'Desativar' : 'Ativar'} onClick={() => patchTemplate.mutate({ id: template.id, json: { active: !template.active } })}><Archive className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" title="Excluir" onClick={() => setReason({ title: 'Excluir modelo', description: `"${template.name}" deixa de aparecer na criação de documentos.`, label: 'Motivo', required: false, confirmLabel: 'Excluir', destructive: true, onConfirm: () => remove.mutate(template.id) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={Boolean(dialog)} onOpenChange={(next) => !next && setDialog(null)}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col">
          <DialogHeader><DialogTitle>{dialog?.template ? 'Editar modelo' : 'Novo modelo'}</DialogTitle></DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Tipo">
                <NativeSelect value={form.typeConfigId} onChange={(event) => setForm({ ...form, typeConfigId: event.target.value })}>
                  <option value="">Todos os tipos</option>
                  {options.typeConfigs.map((type) => <option key={type.id} value={type.id}>{type.sigla} · {type.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Descrição" className="sm:col-span-2"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Conteúdo</span>
              <Button size="sm" variant="ghost" onClick={() => setPreview((value) => !value)}>{preview ? 'Editar texto' : 'Pré-visualizar'}</Button>
            </div>
            {preview && previewDoc ? (
              <div className="rounded-lg border px-4 py-2"><StructuredViewer value={previewDoc} /></div>
            ) : (
              <Textarea rows={14} className="font-mono text-xs" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder={'# 1. Objetivo\n\nDescreva o objetivo.\n\n# 2. Responsabilidades\n\n| Função | Responsabilidade |\n|---|---|\n| [Cargo] | [O que faz] |'} />
            )}
            <p className="text-[11px] text-muted-foreground">
              Títulos com #, listas com - ou 1., tabelas com |. Campos automáticos: {options.placeholders.map((item) => `{{${item}}}`).join(', ')}.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
              Modelo padrão do tipo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}><Save className="mr-1.5 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(importing)} onOpenChange={(next) => !next && setImporting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar modelo Word</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{importing?.fileName}. Arquivos com macros são recusados.</p>
          <Field label="Nome"><Input value={importForm.name} onChange={(event) => setImportForm({ ...importForm, name: event.target.value })} /></Field>
          <Field label="Tipo">
            <NativeSelect value={importForm.typeConfigId} onChange={(event) => setImportForm({ ...importForm, typeConfigId: event.target.value })}>
              <option value="">Todos os tipos</option>
              {options.typeConfigs.map((type) => <option key={type.id} value={type.id}>{type.sigla} · {type.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Descrição"><Input value={importForm.description} onChange={(event) => setImportForm({ ...importForm, description: event.target.value })} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImporting(null)}>Cancelar</Button>
            <Button disabled={!importForm.name.trim() || importDocx.isPending} onClick={() => importDocx.mutate()}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
          <DialogHeader><DialogTitle>Galeria de modelos prontos</DialogTitle></DialogHeader>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {library.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {(library.data ?? []).map((entry) => (
              <label key={entry.key} className={entry.installed ? 'flex items-start gap-3 rounded-lg border px-3 py-2 opacity-60' : 'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 hover:border-primary/40'}>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  disabled={entry.installed}
                  checked={selection.includes(entry.key)}
                  onChange={(event) => setSelection((current) => (event.target.checked ? [...current, entry.key] : current.filter((key) => key !== entry.key)))}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{entry.name}{entry.sigla ? ` (${entry.sigla})` : ''}{entry.installed ? ' · já instalado' : ''}</span>
                  <span className="block text-xs text-muted-foreground">{entry.description}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGalleryOpen(false)}>Fechar</Button>
            <Button disabled={!selection.length || install.isPending} onClick={() => install.mutate(selection)}>Instalar {selection.length || ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReasonDialog state={reason} onClose={() => setReason(null)} />
    </Card>
  );
}

// ------------------------------------------------------------ grupos de acesso

interface AccessGroup { id: string; name: string; description: string | null; active: boolean; members: Array<{ id: string; name: string; email: string }> }

function GroupsSection({ options }: { options: DocOptions }) {
  const qc = useQueryClient();
  const groups = useQuery<AccessGroup[]>({ queryKey: ['documents', 'access-groups'], queryFn: () => api<AccessGroup[]>('/documents/access-groups') });
  const [editing, setEditing] = useState<AccessGroup | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', description: '', userIds: [] as string[] });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['documents', 'access-groups'] });
    void qc.invalidateQueries({ queryKey: ['documents', 'options'] });
  };
  const save = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), description: form.description.trim() || null, userIds: form.userIds };
      return editing && editing !== 'new' ? api(`/documents/access-groups/${editing.id}`, { method: 'PATCH', json: payload }) : api('/documents/access-groups', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Grupo salvo.');
      setEditing(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/documents/access-groups/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Grupos de acesso e leitura</CardTitle>
          <CardDescription>Ex.: Brigada, Laboratório, Turno B. Servem para liberar documentos restritos e distribuir leituras.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditing('new'); setForm({ name: '', description: '', userIds: [] }); }}><Plus className="mr-1.5 h-4 w-4" />Novo grupo</Button>
      </CardHeader>
      <CardContent>
        {!(groups.data ?? []).length ? (
          <p className="text-sm text-muted-foreground">Nenhum grupo criado.</p>
        ) : (
          <ul className="divide-y">
            {(groups.data ?? []).map((group) => (
              <li key={group.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{group.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{group.members.length} pessoa(s){group.members.length ? `: ${group.members.slice(0, 4).map((member) => member.name).join(', ')}${group.members.length > 4 ? '…' : ''}` : ''}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(group); setForm({ name: group.name, description: group.description ?? '', userIds: group.members.map((member) => member.id) }); }}><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => window.confirm(`Excluir o grupo "${group.name}"?`) && remove.mutate(group.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={Boolean(editing)} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Novo grupo' : 'Editar grupo'}</DialogTitle></DialogHeader>
          <Field label="Nome"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Descrição"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <Field label="Pessoas"><MultiSelect options={userOptions(options.users)} value={form.userIds} onChange={(userIds) => setForm({ ...form, userIds })} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// -------------------------------------------------------------- temporalidade

interface RetentionRule { id: string; name: string; retentionDays: number; disposition: string; typeConfigId: string | null; active: boolean }
interface RetentionData { rules: RetentionRule[]; due: Array<{ id: string; code: string | null; number: number; title: string; status: DocStatus; retentionUntil: string | null }> }
const DISPOSITION_LABEL: Record<string, string> = { DESCARTAR: 'Descartar os arquivos', ARQUIVO_PERMANENTE: 'Guarda permanente', REAVALIAR: 'Reavaliar' };

function RetentionSection({ options }: { options: DocOptions }) {
  const qc = useQueryClient();
  const data = useQuery<RetentionData>({ queryKey: ['documents', 'retention'], queryFn: () => api<RetentionData>('/documents/retention') });
  const [editing, setEditing] = useState<RetentionRule | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', retentionDays: '1825', disposition: 'DESCARTAR', typeConfigId: '', active: true });
  const [reason, setReason] = useState<ReasonDialogState | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['documents', 'retention'] });
  const save = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), retentionDays: Number(form.retentionDays), disposition: form.disposition, typeConfigId: form.typeConfigId || null, active: form.active };
      return editing && editing !== 'new' ? api(`/documents/retention-rules/${editing.id}`, { method: 'PATCH', json: payload }) : api('/documents/retention-rules', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Regra salva.');
      setEditing(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const dispose = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api(`/documents/${id}/dispose`, { method: 'POST', json: { reason: text } }),
    onSuccess: () => {
      toast.success('Arquivos descartados. O registro do documento foi mantido.');
      refresh();
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Temporalidade (guarda de documentos obsoletos)</CardTitle>
          <CardDescription>Quanto tempo guardar um documento depois de obsoleto ou arquivado e o que fazer ao final.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditing('new'); setForm({ name: '', retentionDays: '1825', disposition: 'DESCARTAR', typeConfigId: '', active: true }); }}><Plus className="mr-1.5 h-4 w-4" />Nova regra</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!(data.data?.rules ?? []).length ? (
          <p className="text-sm text-muted-foreground">Sem regras: documentos encerrados ficam guardados sem prazo.</p>
        ) : (
          <ul className="divide-y">
            {(data.data?.rules ?? []).map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{rule.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {options.typeConfigs.find((type) => type.id === rule.typeConfigId)?.sigla ?? 'Todos os tipos'} · {Math.round(rule.retentionDays / 365 * 10) / 10} ano(s) · {DISPOSITION_LABEL[rule.disposition] ?? rule.disposition}
                    {!rule.active && ' · inativa'}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(rule); setForm({ name: rule.name, retentionDays: String(rule.retentionDays), disposition: rule.disposition, typeConfigId: rule.typeConfigId ?? '', active: rule.active }); }}><Edit className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
        {(data.data?.due ?? []).length > 0 && (
          <div className="rounded-lg border border-status-yellow/40 bg-status-yellow/5 p-3">
            <p className="mb-2 text-sm font-medium">Prazo de guarda vencido</p>
            <ul className="space-y-1">
              {(data.data?.due ?? []).map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{doc.code ?? `#${doc.number}`} · {doc.title} <span className="text-xs text-muted-foreground">({STATUS_LABEL[doc.status]}, guarda até {formatDateTime(doc.retentionUntil)})</span></span>
                  <Button size="sm" variant="outline" onClick={() => setReason({ title: `Descartar ${doc.code ?? doc.title}`, description: 'Os arquivos são apagados; o registro, o histórico e as assinaturas ficam.', label: 'Justificativa do descarte', confirmLabel: 'Descartar', destructive: true, onConfirm: (text) => dispose.mutate({ id: doc.id, text }) })}>
                    Descartar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <Dialog open={Boolean(editing)} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Nova regra de guarda' : 'Editar regra'}</DialogTitle></DialogHeader>
          <Field label="Nome"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Registros da qualidade" /></Field>
          <Field label="Tipo">
            <NativeSelect value={form.typeConfigId} onChange={(event) => setForm({ ...form, typeConfigId: event.target.value })}>
              <option value="">Todos os tipos</option>
              {options.typeConfigs.map((type) => <option key={type.id} value={type.id}>{type.sigla} · {type.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Guardar por (dias)" hint="1 ano = 365 · 5 anos = 1825"><Input type="number" min={1} max={36500} value={form.retentionDays} onChange={(event) => setForm({ ...form, retentionDays: event.target.value })} /></Field>
          <Field label="Ao final">
            <NativeSelect value={form.disposition} onChange={(event) => setForm({ ...form, disposition: event.target.value })}>
              {Object.entries(DISPOSITION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Regra ativa
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReasonDialog state={reason} onClose={() => setReason(null)} />
    </Card>
  );
}

// ------------------------------------------------------------------- sistema

interface Diagnostics {
  documents: number;
  files: number;
  withoutFiles: number;
  pendingPdfs: number;
  storage: { provider: string; files: number; bytes: number };
  editor: { configured: boolean; provider: string; message?: string };
  converter: { available: boolean };
  generatedAt: string;
}

function SystemSection() {
  const qc = useQueryClient();
  const diagnostics = useQuery<Diagnostics>({ queryKey: ['documents', 'diagnostics'], queryFn: () => api<Diagnostics>('/documents/diagnostics') });
  const maintenance = useMutation({
    mutationFn: () => api('/documents/jobs/maintenance', { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Rotina executada: vencimentos, publicações agendadas, lembretes e índice de busca.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const reindex = useMutation({
    mutationFn: () => api<{ reindexed: number }>('/documents/jobs/reindex', { method: 'POST', json: {} }),
    onSuccess: (result) => toast.success(`${result.reindexed} documento(s) reindexados.`),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const data = diagnostics.data;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" />Armazenamento</CardTitle>
          <CardDescription>Os arquivos ficam no próprio banco do Gestão 360 (com backup junto).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {data ? (
            <>
              <p>Local: <strong>{data.storage.provider === 'DATABASE' ? 'Banco de dados' : 'Disco do servidor'}</strong></p>
              <p>{data.storage.files} arquivo(s) no banco · {formatBytes(data.storage.bytes)}</p>
              <p>{data.documents} documento(s) · {data.files} arquivo(s) registrados</p>
              {data.pendingPdfs > 0 && <p className="text-status-yellow">{data.pendingPdfs} revisão(ões) vigente(s) sem PDF oficial.</p>}
            </>
          ) : (
            <p className="text-muted-foreground">Carregando…</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4" />Editores e conversão</CardTitle>
          <CardDescription>Todos gratuitos: editor visual próprio e Collabora (CODE) para Word.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Editor visual: <Badge variant="outline" className="border-status-green/40 text-status-green">ativo</Badge></p>
          <p>
            Word no navegador:{' '}
            {data?.editor.configured ? <Badge variant="outline" className="border-status-green/40 text-status-green">{data.editor.provider}</Badge> : <Badge variant="outline" className="text-muted-foreground">não configurado</Badge>}
          </p>
          {data && !data.editor.configured && data.editor.message && <p className="text-xs text-muted-foreground">{data.editor.message}</p>}
          <p>
            PDF fiel do Word:{' '}
            {data?.converter.available ? <Badge variant="outline" className="border-status-green/40 text-status-green">conversor ativo</Badge> : <Badge variant="outline" className="text-muted-foreground">sem conversor (PDF simplificado)</Badge>}
          </p>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Rotinas</CardTitle>
          <CardDescription>Rodam sozinhas a cada ciclo do sistema. Use aqui para executar agora.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={maintenance.isPending} onClick={() => maintenance.mutate()}>
            {maintenance.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Vencimentos, agendamentos e lembretes
          </Button>
          <Button size="sm" variant="outline" disabled={reindex.isPending} onClick={() => reindex.mutate()}>
            {reindex.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Reindexar busca
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DocumentConfig({ options }: { options: DocOptions }) {
  return (
    <Tabs defaultValue="tipos">
      <TabsList>
        <TabsTrigger value="tipos">Tipos</TabsTrigger>
        <TabsTrigger value="modelos">Modelos</TabsTrigger>
        <TabsTrigger value="grupos">Grupos</TabsTrigger>
        <TabsTrigger value="guarda">Temporalidade</TabsTrigger>
        <TabsTrigger value="sistema">Sistema</TabsTrigger>
      </TabsList>
      <TabsContent value="tipos"><TypesSection types={options.typeConfigs} /></TabsContent>
      <TabsContent value="modelos"><TemplatesSection options={options} /></TabsContent>
      <TabsContent value="grupos"><GroupsSection options={options} /></TabsContent>
      <TabsContent value="guarda"><RetentionSection options={options} /></TabsContent>
      <TabsContent value="sistema"><SystemSection /></TabsContent>
    </Tabs>
  );
}
