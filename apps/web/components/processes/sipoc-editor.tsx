'use client';

import { useState } from 'react';
import { sipocSchema, type SipocContent } from '@g360/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { EntityPicker } from './entity-picker';
import type { ProcessContext } from './types';

const COLUMNS = [
  { key: 'suppliers', title: 'Fornecedores', letter: 'S' }, { key: 'inputs', title: 'Entradas', letter: 'I' },
  { key: 'steps', title: 'Processo', letter: 'P' }, { key: 'outputs', title: 'Saídas', letter: 'O' }, { key: 'customers', title: 'Clientes', letter: 'C' },
] as const;
type Column = typeof COLUMNS[number]['key'];
const FIELD_LABEL: Record<string, string> = { description: 'Descrição', participation: 'Participação', needs: 'Necessidades e expectativas', expectedResult: 'Resultado esperado', acceptanceCriteria: 'Critérios de aceitação / atendimento', origin: 'Origem', requirements: 'Requisitos', qualityCriteria: 'Critérios de qualidade e validação' };

export function SipocEditor({ value, onChange, editable, process }: { value: SipocContent; onChange: (content: SipocContent) => void; editable: boolean; process: ProcessContext['process'] }) {
  const [editing, setEditing] = useState<{ column: Column; item: any } | null>(null);
  const [error, setError] = useState('');
  const save = () => {
    if (!editing) return;
    const entries = value[editing.column] as Array<{ id: string }>;
    const next = { ...value, [editing.column]: entries.some((item) => item.id === editing.item.id) ? entries.map((item) => item.id === editing.item.id ? editing.item : item) : [...entries, editing.item] };
    const parsed = sipocSchema.safeParse(next);
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join('; ')); return; }
    onChange(parsed.data); setEditing(null);
  };
  return <div className="space-y-4">
    <div className="rounded-lg border bg-muted/20 p-4"><div className="font-semibold">{process.name}</div><p className="text-sm text-muted-foreground">{process.objective || 'Defina o objetivo na visão geral do processo.'}</p><p className="mt-1 text-xs text-muted-foreground">Área: {process.orgNode?.name || 'Não definida'} · Proprietário: {process.owner?.name || 'Não definido'}</p></div>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">{COLUMNS.map((column) => <section key={column.key} className="min-w-0 rounded-lg border bg-card">
      <h3 className="flex items-center gap-2 border-b bg-muted/30 p-3 text-sm font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">{column.letter}</span>{column.title}</h3>
      <div className="space-y-2 p-3">{(value[column.key] as any[]).map((item) => <div key={item.id} className="space-y-2 rounded border p-3 text-sm">
        <button type="button" className="w-full text-left font-medium hover:underline" onClick={() => { setError(''); setEditing({ column: column.key, item: structuredClone(item) }); }}>{item.name}</button>
        {item.description && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{item.description}</p>}
        {item.type && <p className="text-xs text-muted-foreground">{item.type === 'INTERNAL' ? 'Interno' : 'Externo'}</p>}
        {editable && <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => onChange({ ...value, [column.key]: value[column.key].filter((entry) => entry.id !== item.id) })}>Remover</Button>}
      </div>)}
      {!value[column.key].length && <p className="py-4 text-xs text-muted-foreground">Nenhum item cadastrado.</p>}
      {editable && <Button variant="outline" size="sm" className="w-full" onClick={() => { setError(''); const item = { id: crypto.randomUUID(), name: '', description: '', ...(column.key === 'suppliers' || column.key === 'customers' ? { type: 'INTERNAL', participation: '', needs: '', expectedResult: '', acceptanceCriteria: '' } : {}), ...(column.key === 'inputs' ? { origin: '', requirements: '', qualityCriteria: '', documentIds: [], formTemplateIds: [] } : {}), ...(column.key === 'outputs' ? { acceptanceCriteria: '', documentIds: [], indicatorIds: [] } : {}) }; setEditing({ column: column.key, item }); }}>Adicionar</Button>}
      </div>
    </section>)}</div>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{COLUMNS.find((column) => column.key === editing?.column)?.title}</DialogTitle></DialogHeader>
      {editing && <fieldset disabled={!editable} className="space-y-4">
        <div className="space-y-1"><Label>Nome</Label><Input value={editing.item.name} onChange={(event) => setEditing({ ...editing, item: { ...editing.item, name: event.target.value } })} /></div>
        {Object.entries(FIELD_LABEL).filter(([key]) => key in editing.item).map(([key, label]) => <div key={key} className="space-y-1"><Label>{label}</Label><Textarea value={editing.item[key] || ''} onChange={(event) => setEditing({ ...editing, item: { ...editing.item, [key]: event.target.value } })} /></div>)}
        {'type' in editing.item && <><div className="space-y-1"><Label>Tipo</Label><NativeSelect value={editing.item.type} onChange={(event) => setEditing({ ...editing, item: { ...editing.item, type: event.target.value } })}><option value="INTERNAL">Interno</option><option value="EXTERNAL">Externo</option></NativeSelect></div><Label>Área relacionada</Label><EntityPicker type="AREA" label="Área" multiple={false} disabled={!editable} selected={editing.item.orgNodeId ? [editing.item.orgNodeId] : []} onChange={(ids) => setEditing({ ...editing, item: { ...editing.item, orgNodeId: ids[0] || null } })} /><Label>Processo relacionado</Label><EntityPicker type="PROCESS" label="Processo" multiple={false} disabled={!editable} selected={editing.item.relatedProcessId ? [editing.item.relatedProcessId] : []} onChange={(ids) => setEditing({ ...editing, item: { ...editing.item, relatedProcessId: ids[0] || null } })} /></>}
        {editing.column === 'steps' && <div className="space-y-1"><Label>Etapa existente do processo</Label><NativeSelect value={editing.item.processStepId || ''} onChange={(event) => setEditing({ ...editing, item: { ...editing.item, processStepId: event.target.value || null } })}><option value="">Macroetapa livre</option>{process.steps.map((step) => <option key={step.id} value={step.id}>{step.name}</option>)}</NativeSelect></div>}
        {'documentIds' in editing.item && <><Label>Documentos associados</Label><EntityPicker type="DOCUMENT" label="Documentos" selected={editing.item.documentIds} disabled={!editable} onChange={(ids) => setEditing({ ...editing, item: { ...editing.item, documentIds: ids } })} /></>}
        {'formTemplateIds' in editing.item && <><Label>Formulários associados</Label><EntityPicker type="FORM" label="Formulários" selected={editing.item.formTemplateIds} disabled={!editable} onChange={(ids) => setEditing({ ...editing, item: { ...editing.item, formTemplateIds: ids } })} /></>}
        {'indicatorIds' in editing.item && <><Label>Indicadores de qualidade</Label><EntityPicker type="INDICATOR" label="Indicadores" selected={editing.item.indicatorIds} disabled={!editable} onChange={(ids) => setEditing({ ...editing, item: { ...editing.item, indicatorIds: ids } })} /></>}
      </fieldset>}
      {error && <p role="alert" className="text-sm text-status-red">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Fechar</Button>{editable && <Button onClick={save}>Aplicar ao rascunho</Button>}</DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
