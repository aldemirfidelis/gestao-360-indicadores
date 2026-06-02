'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ColumnInfo } from '@/components/database-admin/types';

interface DdlPlan {
  sql: string;
  risk: 'low' | 'medium' | 'high';
  warnings: string[];
  requiresConfirmationPhrase: boolean;
  confirmationPhrase: string;
}

const OPS: { value: string; label: string }[] = [
  { value: 'addColumn', label: 'Adicionar coluna' },
  { value: 'renameColumn', label: 'Renomear coluna' },
  { value: 'alterColumnType', label: 'Alterar tipo da coluna' },
  { value: 'setColumnNullable', label: 'Permitir/Proibir NULL' },
  { value: 'setColumnDefault', label: 'Definir valor padrão' },
  { value: 'dropColumn', label: 'Excluir coluna' },
  { value: 'renameTable', label: 'Renomear tabela' },
  { value: 'createIndex', label: 'Criar índice' },
  { value: 'addUnique', label: 'Adicionar UNIQUE' },
  { value: 'addPrimaryKey', label: 'Adicionar PRIMARY KEY' },
  { value: 'addForeignKey', label: 'Adicionar FOREIGN KEY' },
  { value: 'dropConstraint', label: 'Remover constraint' },
  { value: 'truncateTable', label: 'TRUNCATE (limpar registros)' },
  { value: 'dropTable', label: 'DROP TABLE (excluir tabela)' },
];

const RISK_CLS: Record<string, string> = { low: 'pill-green', medium: 'pill-yellow', high: 'pill-red' };

export function StructureOpDialog({
  table,
  columns,
  initialOperation,
  onClose,
  onDone,
}: {
  table: string;
  columns: ColumnInfo[];
  initialOperation?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [op, setOp] = useState(initialOperation ?? 'addColumn');
  const [f, setF] = useState<Record<string, string>>({});
  const [bools, setBools] = useState<Record<string, boolean>>({ nullable: true });
  const [multiCols, setMultiCols] = useState<string[]>([]);
  const [phrase, setPhrase] = useState('');
  const [plan, setPlan] = useState<DdlPlan | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const colNames = columns.map((c) => c.name);

  function buildParams(): Record<string, unknown> {
    const base: Record<string, unknown> = { table };
    switch (op) {
      case 'addColumn': return { ...base, column: { name: f.name, type: f.type, nullable: bools.nullable, default: f.default || null } };
      case 'renameColumn': return { ...base, column: f.column, newName: f.newName };
      case 'alterColumnType': return { ...base, column: f.column, newType: f.newType, using: bools.using };
      case 'setColumnNullable': return { ...base, column: f.column, nullable: bools.nullable };
      case 'setColumnDefault': return { ...base, column: f.column, default: f.default || null };
      case 'dropColumn': return { ...base, column: f.column };
      case 'renameTable': return { ...base, newName: f.newName };
      case 'createIndex': return { ...base, columns: multiCols, unique: bools.unique, name: f.name || undefined };
      case 'addUnique': return { ...base, columns: multiCols, name: f.name || undefined };
      case 'addPrimaryKey': return { ...base, columns: multiCols };
      case 'addForeignKey': return { ...base, column: f.column, refTable: f.refTable, refColumn: f.refColumn, name: f.name || undefined };
      case 'dropConstraint': return { ...base, name: f.name };
      default: return base; // truncate/drop table
    }
  }

  const previewMut = useMutation({
    mutationFn: () => api<DdlPlan>('/admin/database/structure/preview', { method: 'POST', json: { operation: op, params: buildParams() } }),
    onSuccess: (p) => setPlan(p),
    onError: (e: ApiError) => { setPlan(null); toast.error(e.message); },
  });
  const executeMut = useMutation({
    mutationFn: () => api('/admin/database/structure/execute', { method: 'POST', json: { operation: op, params: buildParams(), confirmationPhrase: phrase } }),
    onSuccess: () => { toast.success('Operação aplicada.'); onDone(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function resetPlan() {
    setPlan(null);
    setPhrase('');
  }

  const colSelect = (k: string) => (
    <NativeSelect value={f[k] ?? ''} onChange={(e) => { set(k, e.target.value); resetPlan(); }}>
      <option value="">Selecione coluna...</option>
      {colNames.map((n) => <option key={n} value={n}>{n}</option>)}
    </NativeSelect>
  );

  const multiSelect = (
    <div className="flex flex-wrap gap-1.5 rounded-lg border p-2">
      {colNames.map((n) => {
        const on = multiCols.includes(n);
        return (
          <button key={n} type="button" onClick={() => { setMultiCols((p) => on ? p.filter((x) => x !== n) : [...p, n]); resetPlan(); }} className={cn('rounded px-2 py-0.5 text-xs', on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{n}</button>
        );
      })}
    </div>
  );

  const canRun = plan && (!plan.requiresConfirmationPhrase || phrase === plan.confirmationPhrase);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estrutura · <span className="font-mono text-sm">{table}</span></DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Operação</Label>
            <NativeSelect value={op} onChange={(e) => { setOp(e.target.value); resetPlan(); setF({}); setMultiCols([]); }}>
              {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {op === 'addColumn' && (<>
              <Field label="Nome da coluna" value={f.name} onChange={(v) => { set('name', v); resetPlan(); }} />
              <Field label="Tipo (ex.: text, integer, uuid)" value={f.type} onChange={(v) => { set('type', v); resetPlan(); }} />
              <Bool label="Permite NULL" checked={bools.nullable ?? true} onChange={(v) => { setBools((b) => ({ ...b, nullable: v })); resetPlan(); }} />
              <Field label="Valor padrão (opcional)" value={f.default} onChange={(v) => { set('default', v); resetPlan(); }} />
            </>)}
            {op === 'renameColumn' && (<>
              <div><Label>Coluna</Label>{colSelect('column')}</div>
              <Field label="Novo nome" value={f.newName} onChange={(v) => { set('newName', v); resetPlan(); }} />
            </>)}
            {op === 'alterColumnType' && (<>
              <div><Label>Coluna</Label>{colSelect('column')}</div>
              <Field label="Novo tipo" value={f.newType} onChange={(v) => { set('newType', v); resetPlan(); }} />
              <Bool label="USING cast" checked={bools.using ?? false} onChange={(v) => { setBools((b) => ({ ...b, using: v })); resetPlan(); }} />
            </>)}
            {op === 'setColumnNullable' && (<>
              <div><Label>Coluna</Label>{colSelect('column')}</div>
              <Bool label="Permite NULL" checked={bools.nullable ?? true} onChange={(v) => { setBools((b) => ({ ...b, nullable: v })); resetPlan(); }} />
            </>)}
            {op === 'setColumnDefault' && (<>
              <div><Label>Coluna</Label>{colSelect('column')}</div>
              <Field label="Valor padrão (vazio = remover)" value={f.default} onChange={(v) => { set('default', v); resetPlan(); }} />
            </>)}
            {op === 'dropColumn' && (<div><Label>Coluna</Label>{colSelect('column')}</div>)}
            {op === 'renameTable' && (<Field label="Novo nome da tabela" value={f.newName} onChange={(v) => { set('newName', v); resetPlan(); }} />)}
            {(op === 'createIndex' || op === 'addUnique' || op === 'addPrimaryKey') && (
              <div className="md:col-span-2"><Label>Colunas</Label>{multiSelect}</div>
            )}
            {op === 'createIndex' && (<>
              <Bool label="Único (UNIQUE)" checked={bools.unique ?? false} onChange={(v) => { setBools((b) => ({ ...b, unique: v })); resetPlan(); }} />
              <Field label="Nome (opcional)" value={f.name} onChange={(v) => { set('name', v); resetPlan(); }} />
            </>)}
            {op === 'addUnique' && (<Field label="Nome (opcional)" value={f.name} onChange={(v) => { set('name', v); resetPlan(); }} />)}
            {op === 'addForeignKey' && (<>
              <div><Label>Coluna</Label>{colSelect('column')}</div>
              <Field label="Tabela referenciada" value={f.refTable} onChange={(v) => { set('refTable', v); resetPlan(); }} />
              <Field label="Coluna referenciada" value={f.refColumn} onChange={(v) => { set('refColumn', v); resetPlan(); }} />
              <Field label="Nome (opcional)" value={f.name} onChange={(v) => { set('name', v); resetPlan(); }} />
            </>)}
            {op === 'dropConstraint' && (<Field label="Nome da constraint" value={f.name} onChange={(v) => { set('name', v); resetPlan(); }} />)}
          </div>

          <Button variant="outline" size="sm" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
            {previewMut.isPending ? 'Gerando...' : 'Pré-visualizar SQL'}
          </Button>

          {plan && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs"><span className={cn('pill', RISK_CLS[plan.risk])}>Risco {plan.risk}</span></div>
              <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">{plan.sql}</pre>
              {plan.warnings.length > 0 && (
                <div className="space-y-1 rounded-lg border border-status-yellow/40 bg-status-yellow/10 p-2 text-xs">
                  {plan.warnings.map((w, i) => <div key={i} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-yellow" />{w}</div>)}
                </div>
              )}
              {plan.requiresConfirmationPhrase && (
                <div>
                  <Label className="text-status-red">Digite: <span className="font-mono">{plan.confirmationPhrase}</span></Label>
                  <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className={plan?.risk === 'high' ? 'bg-status-red text-white hover:bg-status-red/90' : undefined} disabled={!canRun || executeMut.isPending} onClick={() => executeMut.mutate()}>
            {executeMut.isPending ? 'Aplicando...' : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Bool({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
