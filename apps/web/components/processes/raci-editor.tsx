'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { raciConsistency, type RaciContent } from '@g360/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import type { Artifact, ProcessContext, Subject } from './types';
import { EntityPicker } from './entity-picker';
import { downloadCsv } from '@/lib/compensation/format';

const ROLES = ['R', 'A', 'C', 'I'] as const;
const ROLE_LABEL = { R: 'Executa', A: 'Responsável final', C: 'Consultado', I: 'Informado' };
export function RaciEditor({ value, onChange, editable, context, artifact }: { value: RaciContent; onChange: (value: RaciContent) => void; editable: boolean; context: ProcessContext; artifact: Artifact }) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(search), 300); return () => clearTimeout(timer); }, [search]);
  const query = useQuery({ queryKey: ['process-subjects', term], queryFn: () => api<Subject[]>(`/processes/governance/subjects?search=${encodeURIComponent(term)}`), enabled: editable, staleTime: 20_000 });
  const initialColumns = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of artifact.raciRows) for (const assignment of row.assignments) names.set(assignment.subjectKey, assignment.subjectSnapshot.name);
    return [...new Map(value.rows.flatMap((row) => row.assignments.map((assignment) => { const key = `${assignment.subjectType}:${assignment.subjectId}`; return [key, { ...assignment, name: names.get(key) || 'Participante vinculado' }] as const; }))).entries()];
    // A revisão salva recria o editor; colunas removidas continuam visíveis até ação explícita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.id, artifact.revision]);
  const [columns, setColumns] = useState(initialColumns);
  const updateRow = (rowId: string, patch: Partial<RaciContent['rows'][number]>) => onChange({ rows: value.rows.map((row) => row.id === rowId ? { ...row, ...patch } : row) });
  const validation = raciConsistency(value);
  return <div className="space-y-4">
    <Button variant="outline" size="sm" onClick={() => downloadCsv('matriz-raci.csv', [['Atividade', ...columns.map(([, subject]) => subject.name)], ...value.rows.map((row) => [row.name, ...columns.map(([key]) => row.assignments.find((assignment) => `${assignment.subjectType}:${assignment.subjectId}` === key)?.roles.join('+') || '')])])}>Exportar RACI</Button>
    <div className="flex flex-wrap gap-3">{ROLES.map((role) => <span key={role} className="rounded border bg-muted/20 px-2 py-1 text-xs"><strong>{role}</strong> — {ROLE_LABEL[role]}</span>)}</div>
    {editable && <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><div className="space-y-1"><Label>Buscar pessoa, área ou cargo</Label><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome do participante" /></div><div className="space-y-1"><Label>Adicionar coluna</Label><NativeSelect value="" onChange={(event) => { const subject = query.data?.find((item) => `${item.subjectType}:${item.id}` === event.target.value); if (!subject) return; setColumns((current) => current.some(([key]) => key === event.target.value) ? current : [...current, [event.target.value, { subjectType: subject.subjectType, subjectId: subject.id, roles: [], name: subject.name }]]); }}><option value="">Selecionar participante</option>{query.data?.map((item) => <option key={`${item.subjectType}:${item.id}`} value={`${item.subjectType}:${item.id}`}>{item.name} · {item.subjectType === 'USER' ? 'Pessoa' : item.subjectType === 'AREA' ? 'Área' : 'Cargo'}</option>)}</NativeSelect></div>{query.isError && <p role="alert" className="text-sm text-status-red">{query.error.message}</p>}</div>}
    <div className="overflow-x-auto rounded-lg border"><table className="w-full border-collapse text-sm"><thead><tr className="bg-muted/30"><th className="min-w-[260px] p-3 text-left">Atividade / entrega</th>{columns.map(([key, subject]) => <th key={key} className="min-w-[170px] border-l p-3 text-left"><div>{(editable && query.data?.find((item) => `${item.subjectType}:${item.id}` === key)?.name) || subject.name}</div><div className="text-xs font-normal text-muted-foreground">{subject.subjectType === 'USER' ? 'Pessoa' : subject.subjectType === 'AREA' ? 'Área' : 'Cargo'}</div>{editable && <Button size="sm" variant="ghost" className="mt-1 h-6 px-1 text-xs" onClick={() => { setColumns((current) => current.filter(([item]) => item !== key)); onChange({ rows: value.rows.map((row) => ({ ...row, assignments: row.assignments.filter((assignment) => `${assignment.subjectType}:${assignment.subjectId}` !== key) })) }); }}>Remover coluna</Button>}</th>)}</tr></thead><tbody>
      {value.rows.map((row) => <tr key={row.id} className="border-t align-top"><td className="space-y-2 p-3"><Input aria-label="Atividade da matriz" disabled={!editable} value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} />
        <NativeSelect aria-label="Tipo de atividade vinculada" disabled={!editable} value={row.targetType || ''} onChange={(event) => updateRow(row.id, { targetType: (event.target.value || null) as any, targetId: null })}><option value="">Responsabilidade do processo</option><option value="ACTIVITY">Atividade BPMN</option><option value="STEP">Etapa do processo</option><option value="PROJECT_TASK">Tarefa de projeto</option><option value="TASK">Tarefa</option><option value="ACTION">Plano de ação</option></NativeSelect>
        {row.targetType === 'ACTIVITY' && <NativeSelect disabled={!editable} value={row.targetId || ''} onChange={(event) => updateRow(row.id, { targetId: event.target.value || null })}><option value="">Selecionar atividade</option>{context.activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name} · {activity.artifact?.scenario}</option>)}</NativeSelect>}
        {row.targetType === 'STEP' && <NativeSelect disabled={!editable} value={row.targetId || ''} onChange={(event) => updateRow(row.id, { targetId: event.target.value || null })}><option value="">Selecionar etapa</option>{context.process.steps.map((step) => <option key={step.id} value={step.id}>{step.name}</option>)}</NativeSelect>}
        {row.targetType && ['PROJECT_TASK', 'TASK', 'ACTION'].includes(row.targetType) && <EntityPicker type={row.targetType as 'PROJECT_TASK' | 'TASK' | 'ACTION'} label="Registro" selected={row.targetId ? [row.targetId] : []} multiple={false} disabled={!editable} onChange={(ids) => updateRow(row.id, { targetId: ids[0] || null })} />}
        {editable && <Button size="sm" variant="ghost" className="h-6 px-1 text-xs text-status-red" onClick={() => onChange({ rows: value.rows.filter((entry) => entry.id !== row.id) })}>Remover atividade</Button>}
      </td>{columns.map(([key, subject]) => {
        const assignment = row.assignments.find((item) => `${item.subjectType}:${item.subjectId}` === key);
        return <td key={key} className="border-l p-3"><div className="flex flex-wrap gap-2">{ROLES.map((role) => <label key={role} className="inline-flex cursor-pointer items-center gap-1 rounded border p-1.5 text-xs" title={ROLE_LABEL[role]}><input type="checkbox" disabled={!editable} aria-label={`${role}: ${row.name} / ${subject.name}`} checked={assignment?.roles.includes(role) || false} onChange={(event) => { const roles = event.target.checked ? [...(assignment?.roles ?? []), role] : (assignment?.roles ?? []).filter((value) => value !== role); const rest = row.assignments.filter((item) => `${item.subjectType}:${item.subjectId}` !== key); updateRow(row.id, { assignments: roles.length ? [...rest, { subjectType: subject.subjectType, subjectId: subject.subjectId, roles }] : rest }); }} />{role}</label>)}</div></td>;
      })}</tr>)}
      {!value.rows.length && <tr><td colSpan={Math.max(1, columns.length + 1)} className="p-6 text-muted-foreground">Adicione atividades do processo e defina os participantes.</td></tr>}
    </tbody></table></div>
    {editable && <Button variant="outline" onClick={() => onChange({ rows: [...value.rows, { id: crypto.randomUUID(), name: '', assignments: [] }] })}>Adicionar atividade</Button>}
    {(validation.errors.length > 0 || validation.warnings.length > 0) && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><div className="font-medium">Consistência da matriz</div>{[...validation.errors, ...validation.warnings].map((issue) => <p key={issue}>{issue}</p>)}<p className="mt-2 text-xs">O rascunho pode ser salvo incompleto. A revisão exige um A e ao menos um R em cada atividade; a mesma pessoa pode ser R e A.</p></div>}
  </div>;
}
