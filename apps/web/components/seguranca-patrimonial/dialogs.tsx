'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CarFront,
  CheckCircle2,
  DoorOpen,
  Download,
  FileWarning,
  KeyRound,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  PackageCheck,
  Plus,
  QrCode,
  RadioTower,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { useAssetSecurityDashboard } from '@/hooks/asset-security/use-asset-security-dashboard';
import {
  AUTH_STATUS_LABELS,
  CUSTODY_STATUS_LABELS,
  CUSTODY_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  INCIDENT_SEVERITY_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  PACKAGE_STATUS_LABELS,
  PERSON_TYPE_LABELS,
  RECORD_STATUS_LABELS,
  labelFor,
  statusTone,
  toOptions,
} from '@/lib/asset-security/labels';
import { dwellMinutes, formatDateTime, formatDuration } from '@/lib/asset-security/format';
import { averageDwellMinutes, documentCompliance, roundsCompliance } from '@/lib/asset-security/analytics';
import { MovementFlowChart } from '@/components/asset-security/movement-flow-chart';
import { IncidentBreakdownChart } from '@/components/asset-security/incident-breakdown-chart';
import { MovementDetailDialog } from '@/components/asset-security/movement-detail-dialog';
import { AuthorizationDetailDialog } from '@/components/asset-security/authorization-detail-dialog';
import { IncidentsSection } from '@/components/asset-security/incidents-section';
import { RoundsSection } from '@/components/asset-security/rounds-section';
import { ShiftHandoverSection } from '@/components/asset-security/shift-handover-section';
import { CorrespondenceSection } from '@/components/asset-security/correspondence-section';
import { DocumentRequirementsSection } from '@/components/asset-security/document-requirements-section';
import { BlocklistSection } from '@/components/asset-security/blocklist-section';
import { AuditLogSection } from '@/components/asset-security/audit-log-section';
import { OfflineSyncSection } from '@/components/asset-security/offline-sync-section';
import type {
  AnyRecord,
  AssistantInsightsResponse,
  SecurityMovement,
  SecurityOptions,
  SecuritySummary,
} from '@/lib/asset-security/types';
import type { TabKey, DialogField, EntityDialogState } from './types';

import { normalizePayload, type Options } from './dialog-configs';

export function QrValidateDialog({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<AnyRecord | null>(null);
  const validate = useMutation({
    mutationFn: (value: string) => api<AnyRecord>(`/asset-security/qrcodes/validate/${encodeURIComponent(value)}`),
    onSuccess: (data) => setResult(data),
    onError: (e: any) => { setResult(null); toast.error(e?.message ?? 'código QR não encontrado'); },
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Validar código QR</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Token do código QR</Label>
            <Input value={token} placeholder="Cole ou digite o token lido" onChange={(e) => { setToken(e.target.value); setResult(null); }} />
          </div>
          {result && (
            <div className={cn('rounded-md border p-3 text-sm', result.valid ? 'border-status-green/40 bg-status-green/5' : 'border-status-red/40 bg-status-red/5')}>
              <div className="flex items-center gap-2 font-medium">
                {result.valid ? <CheckCircle2 className="h-4 w-4 text-status-green" /> : <AlertTriangle className="h-4 w-4 text-status-red" />}
                {result.valid ? 'código QR válido' : `Inválido${result.reason ? ` — ${labelFor(String(result.reason))}` : ''}`}
              </div>
              {result.qr && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <div>Entidade: {result.qr.entityType} · {result.qr.entityId}</div>
                  <div>Finalidade: {result.qr.purpose}</div>
                  {result.qr.expiresAt && <div>Expira em: {formatDateTime(result.qr.expiresAt)}</div>}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={!token.trim() || validate.isPending} onClick={() => validate.mutate(token.trim())}>{validate.isPending ? 'Validando…' : 'Validar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EntryPersonKind = 'EMPLOYEE' | 'THIRD_PARTY' | 'VISITOR';

const ENTRY_PERSON_KIND_OPTIONS: Array<{ value: EntryPersonKind; label: string }> = [
  { value: 'EMPLOYEE', label: 'Funcionario' },
  { value: 'THIRD_PARTY', label: 'Terceiro' },
  { value: 'VISITOR', label: 'Visitante' },
];

export function EntryDialog({ optionValues, onCreatePerson, onClose, onSaved }: { optionValues: Options; onCreatePerson: (defaults: AnyRecord) => void; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    personKind: 'EMPLOYEE' as EntryPersonKind,
    gateId: '',
    postId: '',
    personId: '',
    personSearch: '',
    vehicleId: '',
    plate: '',
    contractorCompanyId: '',
    reason: '',
    destinationAreaId: '',
    expectedExitAt: '',
    notes: '',
  });
  const searchTerm = form.personSearch.trim();
  const personLookup = useQuery<{ person: AnyRecord | null; vehicles: AnyRecord[] }>({
    queryKey: ['asset-security', 'people-lookup', form.personKind, searchTerm],
    queryFn: () => api(`/asset-security/people/lookup?kind=${encodeURIComponent(form.personKind)}&search=${encodeURIComponent(searchTerm)}`),
    enabled: searchTerm.length >= 2,
    staleTime: 15_000,
  });
  const foundPerson = personLookup.data?.person ?? null;
  const linkedVehicles = useMemo(() => personLookup.data?.vehicles ?? [], [personLookup.data?.vehicles]);
  const vehicleOptions = linkedVehicles.length
    ? linkedVehicles.map((row) => ({ value: row.id, label: `${row.plate}${row.model ? ` - ${row.model}` : ''}` }))
    : optionValues.vehicles;
  const selectedVehicle = linkedVehicles.find((row) => row.id === form.vehicleId) ?? null;
  const selectedPlate = normalizePlateInput(selectedVehicle?.plate);
  const typedPlate = normalizePlateInput(form.plate);
  const plateDiffers = Boolean(selectedPlate && typedPlate && selectedPlate !== typedPlate);
  const typedDocument = digitsOnlyText(searchTerm).length >= 8 && !/[a-z]/i.test(searchTerm);
  const needsExistingPerson = form.personKind !== 'EMPLOYEE' && typedDocument;
  const canSubmit = Boolean(form.gateId && searchTerm && (!needsExistingPerson || foundPerson));

  useEffect(() => {
    setForm((current) => {
      const nextPersonId = foundPerson?.id ?? '';
      const nextContractorId = foundPerson?.contractorCompanyId ?? current.contractorCompanyId;
      if (current.personId === nextPersonId && current.contractorCompanyId === nextContractorId) return current;
      return { ...current, personId: nextPersonId, contractorCompanyId: nextContractorId };
    });
  }, [foundPerson?.id, foundPerson?.contractorCompanyId]);

  useEffect(() => {
    if (linkedVehicles.length !== 1) return;
    setForm((current) => current.vehicleId ? current : { ...current, vehicleId: linkedVehicles[0].id, plate: linkedVehicles[0].plate ?? current.plate });
  }, [linkedVehicles]);

  const save = useMutation({
    mutationFn: () =>
      api('/asset-security/movements/entry', {
        method: 'POST',
        json: {
          personKind: form.personKind,
          gateId: form.gateId || null,
          postId: form.postId || null,
          personId: form.personId || null,
          personSearch: form.personId ? null : searchTerm,
          vehicleId: form.vehicleId || null,
          plate: form.plate || null,
          contractorCompanyId: form.contractorCompanyId || foundPerson?.contractorCompanyId || null,
          autoCreateVehicle: true,
          reason: form.reason || null,
          destinationAreaId: form.destinationAreaId || null,
          expectedExitAt: form.expectedExitAt || null,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success('Entrada registrada');
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar entrada'),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar entrada</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label className="field-required">Tipo de acesso</Label>
            <NativeSelect
              value={form.personKind}
              onChange={(e) => setForm((current) => ({
                ...current,
                personKind: e.target.value as EntryPersonKind,
                personId: '',
                personSearch: '',
                vehicleId: '',
                plate: '',
                contractorCompanyId: '',
              }))}
            >
              {ENTRY_PERSON_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label className="field-required">Portaria</Label>
            <NativeSelect value={form.gateId} onChange={(e) => setForm((current) => ({ ...current, gateId: e.target.value }))}>
              <option value="">Selecione</option>
              {optionValues.gates.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Posto</Label>
            <NativeSelect value={form.postId} onChange={(e) => setForm((current) => ({ ...current, postId: e.target.value }))}>
              <option value="">Selecione</option>
              {optionValues.posts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label className="field-required">{form.personKind === 'EMPLOYEE' ? 'Cadastro do colaborador' : 'CPF da pessoa'}</Label>
            <Input
              value={form.personSearch}
              placeholder={form.personKind === 'EMPLOYEE' ? 'Digite cadastro, CPF ou nome' : 'Digite CPF ou nome cadastrado'}
              onChange={(e) => setForm((current) => ({ ...current, personSearch: e.target.value, personId: '', vehicleId: '', plate: '' }))}
            />
          </div>
          <div>
            <Label>Empresa prestadora</Label>
            <NativeSelect
              value={form.contractorCompanyId}
              disabled={form.personKind === 'EMPLOYEE'}
              onChange={(e) => setForm((current) => ({ ...current, contractorCompanyId: e.target.value }))}
            >
              <option value="">Sem empresa</option>
              {optionValues.contractorCompanies.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </div>
          <div className="md:col-span-2">
            <PersonLookupPanel
              loading={personLookup.isFetching}
              searched={searchTerm.length >= 2}
              person={foundPerson}
              companyLabel={companyLabel(optionValues, form.contractorCompanyId || foundPerson?.contractorCompanyId)}
              kind={form.personKind}
              onCreate={() => onCreatePerson(personDefaultsFromEntry(form))}
            />
          </div>
          <div>
            <Label>Veículo cadastrado</Label>
            <NativeSelect value={form.vehicleId} onChange={(e) => setForm((current) => ({ ...current, vehicleId: e.target.value }))}>
              <option value="">Sem veículo cadastrado</option>
              {vehicleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Placa da entrada</Label>
            <Input value={form.plate} placeholder="ABC1D23" onChange={(e) => setForm((current) => ({ ...current, plate: e.target.value }))} />
            {(typedPlate && !selectedPlate) && <p className="mt-1 text-xs text-muted-foreground">Se a placa nao existir, o sistema cadastra o veiculo ao registrar.</p>}
            {plateDiffers && <p className="mt-1 text-xs text-status-yellow">Placa diferente do veiculo selecionado: sera cadastrado/vinculado novo veiculo.</p>}
          </div>
          <div>
            <Label>Área de destino</Label>
            <NativeSelect value={form.destinationAreaId} onChange={(e) => setForm((current) => ({ ...current, destinationAreaId: e.target.value }))}>
              <option value="">Sem área</option>
              {optionValues.orgNodes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Previsão de saída</Label>
            <Input type="datetime-local" value={form.expectedExitAt} onChange={(e) => setForm((current) => ({ ...current, expectedExitAt: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Motivo</Label>
            <Input value={form.reason} onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={save.isPending || !canSubmit} onClick={() => save.mutate()}>
            {save.isPending ? 'Registrando...' : 'Registrar entrada'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonLookupPanel({ loading, searched, person, companyLabel, kind, onCreate }: { loading: boolean; searched: boolean; person: AnyRecord | null; companyLabel?: string; kind: EntryPersonKind; onCreate: () => void }) {
  if (!searched) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Digite o cadastro do colaborador ou o CPF/nome para buscar o cadastro antes de registrar a entrada.
      </div>
    );
  }
  if (loading) {
    return <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Buscando cadastro...</div>;
  }
  if (!person) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-status-yellow/40 bg-status-yellow/5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>{kind === 'EMPLOYEE' ? 'Colaborador nao encontrado na base importada.' : 'Pessoa nao encontrada. Cadastre antes de registrar a entrada.'}</span>
        <Button type="button" size="sm" variant="outline" onClick={onCreate}>Cadastrar pessoa</Button>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-status-green/40 bg-status-green/5 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{person.name}</span>
        <StatusBadge value={person.type} label={labelFor(person.type, PERSON_TYPE_LABELS)} tone="green" />
        {person.code && <span className="text-xs text-muted-foreground">Cadastro: {person.code}</span>}
        {person.documentMasked && <span className="text-xs text-muted-foreground">Documento: {person.documentMasked}</span>}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {[companyLabel, person.jobTitle].filter(Boolean).join(' · ') || 'Cadastro localizado em SecurityPerson.'}
      </div>
    </div>
  );
}

function personDefaultsFromEntry(form: { personKind: EntryPersonKind; personSearch: string; contractorCompanyId: string }) {
  const documentNumber = digitsOnlyText(form.personSearch);
  const isDocument = documentNumber.length >= 8 && !/[a-z]/i.test(form.personSearch);
  return {
    name: isDocument ? '' : form.personSearch.trim(),
    type: form.personKind === 'THIRD_PARTY' ? 'CONTRACTOR' : form.personKind,
    documentType: 'CPF',
    documentNumber: documentNumber || '',
    contractorCompanyId: form.contractorCompanyId || '',
    documentStatus: 'NOT_REQUIRED',
  };
}

function companyLabel(optionValues: Options, companyId?: string | null) {
  if (!companyId) return '';
  return optionValues.contractorCompanies.find((option) => option.value === companyId)?.label ?? '';
}

function digitsOnlyText(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizePlateInput(value: unknown) {
  return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function ExitDialog({ openMovements, onClose, onSaved }: { openMovements: SecurityMovement[]; onClose: () => void; onSaved: () => void }) {
  const [movementId, setMovementId] = useState('');
  const [notes, setNotes] = useState('');
  const selected = openMovements.find((movement) => movement.id === movementId) ?? null;
  const save = useMutation({
    mutationFn: () => api('/asset-security/movements/exit', { method: 'POST', json: { id: movementId, notes } }),
    onSuccess: () => {
      toast.success('Saída registrada');
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar saída'),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registrar saída</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="field-required">ID da entrada em aberto</Label>
            <NativeSelect value={movementId} onChange={(e) => setMovementId(e.target.value)}>
              <option value="">Selecione uma entrada aberta</option>
              {openMovements.map((movement) => (
                <option key={movement.id} value={movement.id}>{movement.code ?? movement.id} - {movementLabel(movement)}</option>
              ))}
            </NativeSelect>
          </div>
          <ReadOnlyField label="Pessoa" value={selected?.person?.name ?? '—'} />
          <ReadOnlyField label="Veículo" value={selected?.vehicle?.model ?? selected?.vehicle?.type ?? '—'} />
          <ReadOnlyField label="Placa" value={selected?.plate ?? selected?.vehicle?.plate ?? '—'} />
          <ReadOnlyField label="Portaria" value={selected?.gate?.name ?? '—'} />
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={save.isPending || !movementId} onClick={() => save.mutate()}>
            {save.isPending ? 'Registrando...' : 'Registrar saída'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="min-h-10 rounded-md border bg-muted/30 px-3 py-2 text-sm">{value || '—'}</div>
    </div>
  );
}

function movementLabel(movement: SecurityMovement) {
  return movement.person?.name ?? movement.plate ?? movement.vehicle?.plate ?? 'Sem identificação';
}

/* ------------------------------ Generic dialog ---------------------------- */

export function EntityDialog({ state, onClose, onSaved }: { state: EntityDialogState; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AnyRecord>(() => state.defaults ?? {});
  const save = useMutation({
    mutationFn: () => api(state.path, { method: state.method ?? 'POST', json: normalizePayload(form, state.fields) }),
    onSuccess: () => { toast.success(state.success); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{state.title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {state.fields.map((field) => (
            <FieldInput key={field.name} field={field} value={form[field.name]} onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))} />
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={save.isPending || state.fields.some((f) => f.required && !String(form[f.name] ?? '').trim())} onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }: { field: DialogField; value: unknown; onChange: (value: unknown) => void }) {
  const label = <Label className={field.required ? 'field-required' : ''}>{field.label}</Label>;
  if (field.type === 'textarea') return <div className="md:col-span-2">{label}<Textarea rows={3} value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} /></div>;
  if (field.type === 'select') return <div>{label}<NativeSelect value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{(field.options ?? []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</NativeSelect></div>;
  if (field.type === 'checkbox') return <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />{field.label}</label>;
  return <div>{label}<Input type={field.type === 'datetime' ? 'datetime-local' : field.type === 'number' ? 'number' : 'text'} value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} /></div>;
}

/* ------------------------------ Option builder ---------------------------- */

