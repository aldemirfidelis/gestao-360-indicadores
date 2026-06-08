'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Factory, Link2, Package, Plus, RefreshCw, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type SupplierStatus = 'PROSPECT' | 'APPROVED' | 'CONDITIONAL' | 'BLOCKED' | 'INACTIVE';
type SupplierCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type MaterialCategory = 'RAW_MATERIAL' | 'INGREDIENT' | 'PACKAGING' | 'PROCESS_AID' | 'FINISHED_PRODUCT' | 'OTHER';
type MaterialStatus = 'ACTIVE' | 'UNDER_REVIEW' | 'BLOCKED' | 'INACTIVE';
type LotType = 'RECEIVED' | 'PRODUCED' | 'SHIPPED' | 'INTERNAL_TRANSFER';
type LotStatus = 'QUARANTINED' | 'RELEASED' | 'BLOCKED' | 'CONSUMED' | 'EXPIRED' | 'RECALLED';
type TraceEventType = 'RECEIPT' | 'CONSUMPTION' | 'PRODUCTION' | 'TRANSFER' | 'SHIPMENT' | 'RETURN' | 'DISPOSAL';
type RecallStatus = 'DRAFT' | 'SIMULATION' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
type RecallSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type RecallItemStatus = 'PENDING' | 'NOTIFIED' | 'RETURNED' | 'DISPOSED' | 'RELEASED';

interface UserRef { id: string; name: string; email?: string }
interface StepRef { id: string; number: number; name: string }
interface ProcessRef { id: string; name: string; code: string | null; steps?: StepRef[] }

interface SupplySummary {
  suppliers: number;
  suppliersApproved: number;
  suppliersBlocked: number;
  criticalSuppliers: number;
  materials: number;
  materialsBlocked: number;
  lots: number;
  lotsBlocked: number;
  lotsRecalled: number;
  expiringLots: number;
  recalls: number;
  activeRecalls: number;
  criticalRecalls: number;
}

interface Supplier {
  id: string;
  code: string | null;
  name: string;
  legalName: string | null;
  taxId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  suppliedCategories: string | null;
  criticality: SupplierCriticality;
  status: SupplierStatus;
  score: number | null;
  documentsStatus: string | null;
  nextReviewAt: string | null;
  responsibleUserId: string | null;
  responsible: UserRef | null;
  _count?: { materials: number; lots: number };
}

interface Material {
  id: string;
  code: string | null;
  name: string;
  category: MaterialCategory;
  unit: string | null;
  specification: string | null;
  storageCondition: string | null;
  allergens: string | null;
  hazards: string | null;
  requiredDocuments: string | null;
  shelfLifeDays: number | null;
  status: MaterialStatus;
  supplierId: string | null;
  supplier: Pick<Supplier, 'id' | 'name' | 'code' | 'status' | 'criticality'> | null;
  _count?: { lots: number };
}

interface Lot {
  id: string;
  code: string;
  type: LotType;
  status: LotStatus;
  quantity: number | null;
  unit: string | null;
  receivedAt: string | null;
  producedAt: string | null;
  expiresAt: string | null;
  storageLocation: string | null;
  customerName: string | null;
  destination: string | null;
  notes: string | null;
  materialId: string | null;
  supplierId: string | null;
  processId: string | null;
  material: Pick<Material, 'id' | 'name' | 'code' | 'category' | 'allergens'> | null;
  supplier: Pick<Supplier, 'id' | 'name' | 'code' | 'status'> | null;
  process: ProcessRef | null;
  _count?: { outgoingTraceLinks: number; incomingTraceLinks: number; recallItems: number };
}

interface TraceLink {
  id: string;
  fromLotId: string | null;
  toLotId: string | null;
  eventType: TraceEventType;
  quantity: number | null;
  unit: string | null;
  occurredAt: string;
  notes: string | null;
  fromLot: Lot | null;
  toLot: Lot | null;
  process: ProcessRef | null;
  step: StepRef | null;
}

interface TraceResult {
  rootLot: Lot;
  depth: number;
  backward: Array<{ depth: number; link: TraceLink }>;
  forward: Array<{ depth: number; link: TraceLink }>;
  backwardLotIds: string[];
  forwardLotIds: string[];
  impactedLotIds: string[];
}

interface RecallItem {
  id: string;
  status: RecallItemStatus;
  quantity: number | null;
  unit: string | null;
  disposition: string | null;
  notifiedAt: string | null;
  lot: Lot;
}

interface Recall {
  id: string;
  code: string | null;
  title: string;
  reason: string | null;
  severity: RecallSeverity;
  status: RecallStatus;
  scopeDescription: string | null;
  affectedQuantity: number | null;
  unit: string | null;
  initiatedAt: string | null;
  closedAt: string | null;
  actions: string | null;
  notes: string | null;
  rootLotId: string | null;
  rootLot: Lot | null;
  responsibleUserId: string | null;
  responsible: UserRef | null;
  items: RecallItem[];
}

const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = {
  PROSPECT: 'Prospect',
  APPROVED: 'Homologado',
  CONDITIONAL: 'Condicional',
  BLOCKED: 'Bloqueado',
  INACTIVE: 'Inativo',
};
const CRIT_LABEL: Record<SupplierCriticality | RecallSeverity, string> = { LOW: 'Baixa', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Critica' };
const MATERIAL_CATEGORY_LABEL: Record<MaterialCategory, string> = {
  RAW_MATERIAL: 'Materia-prima',
  INGREDIENT: 'Ingrediente',
  PACKAGING: 'Embalagem',
  PROCESS_AID: 'Auxiliar',
  FINISHED_PRODUCT: 'Produto acabado',
  OTHER: 'Outro',
};
const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = { ACTIVE: 'Ativo', UNDER_REVIEW: 'Em revisao', BLOCKED: 'Bloqueado', INACTIVE: 'Inativo' };
const LOT_TYPE_LABEL: Record<LotType, string> = { RECEIVED: 'Recebido', PRODUCED: 'Produzido', SHIPPED: 'Expedido', INTERNAL_TRANSFER: 'Transferencia' };
const LOT_STATUS_LABEL: Record<LotStatus, string> = { QUARANTINED: 'Quarentena', RELEASED: 'Liberado', BLOCKED: 'Bloqueado', CONSUMED: 'Consumido', EXPIRED: 'Vencido', RECALLED: 'Recolhido' };
const TRACE_EVENT_LABEL: Record<TraceEventType, string> = { RECEIPT: 'Recebimento', CONSUMPTION: 'Consumo', PRODUCTION: 'Producao', TRANSFER: 'Transferencia', SHIPMENT: 'Expedicao', RETURN: 'Retorno', DISPOSAL: 'Descarte' };
const RECALL_STATUS_LABEL: Record<RecallStatus, string> = { DRAFT: 'Rascunho', SIMULATION: 'Simulado', ACTIVE: 'Ativo', CLOSED: 'Encerrado', CANCELLED: 'Cancelado' };

const STATUS_CLASS: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  RELEASED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-emerald-100 text-emerald-700',
  CONDITIONAL: 'bg-amber-100 text-amber-700',
  QUARANTINED: 'bg-amber-100 text-amber-700',
  SIMULATION: 'bg-sky-100 text-sky-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  PROSPECT: 'bg-slate-100 text-slate-600',
  BLOCKED: 'bg-rose-100 text-rose-700',
  RECALLED: 'bg-rose-100 text-rose-700',
  ACTIVE_RECALL: 'bg-rose-100 text-rose-700',
};

type ViewKey = 'suppliers' | 'materials' | 'lots' | 'trace' | 'recalls';

export function SupplyChainTab({
  programId,
  canManage,
  users,
  processes,
}: {
  programId: string;
  canManage: boolean;
  users: UserRef[];
  processes: ProcessRef[];
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewKey>('suppliers');
  const [supplierDialog, setSupplierDialog] = useState<Supplier | 'new' | null>(null);
  const [materialDialog, setMaterialDialog] = useState<Material | 'new' | null>(null);
  const [lotDialog, setLotDialog] = useState<Lot | 'new' | null>(null);
  const [traceDialog, setTraceDialog] = useState(false);
  const [recallDialog, setRecallDialog] = useState<Recall | 'new' | null>(null);
  const [recallRootId, setRecallRootId] = useState('');

  const querySuffix = programId ? `?programId=${encodeURIComponent(programId)}` : '';
  const suppliers = useQuery<Supplier[]>({ queryKey: ['fsms', 'suppliers', programId], queryFn: () => api(`/food-safety/suppliers${querySuffix}`), enabled: !!programId });
  const materials = useQuery<Material[]>({ queryKey: ['fsms', 'materials', programId], queryFn: () => api(`/food-safety/materials${querySuffix}`), enabled: !!programId });
  const lots = useQuery<Lot[]>({ queryKey: ['fsms', 'lots', programId], queryFn: () => api(`/food-safety/lots${querySuffix}`), enabled: !!programId });
  const recalls = useQuery<Recall[]>({ queryKey: ['fsms', 'recalls', programId], queryFn: () => api(`/food-safety/recalls${querySuffix}`), enabled: !!programId });
  const summary = useQuery<SupplySummary>({ queryKey: ['fsms', 'supply-chain-summary', programId], queryFn: () => api(`/food-safety/supply-chain-summary${querySuffix}`), enabled: !!programId });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['fsms'] });
  }

  const rows = {
    suppliers: suppliers.data ?? [],
    materials: materials.data ?? [],
    lots: lots.data ?? [],
    recalls: recalls.data ?? [],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <SummaryCard label="Fornecedores" value={summary.data?.suppliers ?? 0} icon={<Truck className="h-4 w-4" />} />
        <SummaryCard label="Homologados" value={summary.data?.suppliersApproved ?? 0} />
        <SummaryCard label="Materiais" value={summary.data?.materials ?? 0} icon={<Package className="h-4 w-4" />} />
        <SummaryCard label="Lotes" value={summary.data?.lots ?? 0} icon={<Factory className="h-4 w-4" />} />
        <SummaryCard label="Bloqueados" value={(summary.data?.lotsBlocked ?? 0) + (summary.data?.materialsBlocked ?? 0)} tone="risk" />
        <SummaryCard label="Recalls ativos" value={summary.data?.activeRecalls ?? 0} tone="risk" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          {([
            ['suppliers', 'Fornecedores'],
            ['materials', 'Materias-primas'],
            ['lots', 'Lotes'],
            ['trace', 'Rastreabilidade'],
            ['recalls', 'Recall'],
          ] as Array<[ViewKey, string]>).map(([key, label]) => (
            <Button key={key} variant={view === key ? 'default' : 'outline'} size="sm" onClick={() => setView(key)}>
              {label}
            </Button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            {canManage && view === 'suppliers' && <Button size="sm" onClick={() => setSupplierDialog('new')}><Plus className="mr-2 h-4 w-4" />Fornecedor</Button>}
            {canManage && view === 'materials' && <Button size="sm" onClick={() => setMaterialDialog('new')}><Plus className="mr-2 h-4 w-4" />Material</Button>}
            {canManage && view === 'lots' && <Button size="sm" onClick={() => setLotDialog('new')}><Plus className="mr-2 h-4 w-4" />Lote</Button>}
            {canManage && view === 'trace' && <Button size="sm" onClick={() => setTraceDialog(true)}><Link2 className="mr-2 h-4 w-4" />Vinculo</Button>}
            {canManage && view === 'recalls' && <Button size="sm" onClick={() => { setRecallRootId(rows.lots[0]?.id ?? ''); setRecallDialog('new'); }}><RefreshCw className="mr-2 h-4 w-4" />Recall</Button>}
          </div>
        </CardContent>
      </Card>

      {view === 'suppliers' && <SuppliersTable rows={rows.suppliers} loading={suppliers.isPending} canManage={canManage} onEdit={setSupplierDialog} />}
      {view === 'materials' && <MaterialsTable rows={rows.materials} loading={materials.isPending} canManage={canManage} onEdit={setMaterialDialog} />}
      {view === 'lots' && (
        <LotsTable
          rows={rows.lots}
          loading={lots.isPending}
          canManage={canManage}
          onEdit={setLotDialog}
          onTrace={(lot) => setViewWithLot('trace', lot.id)}
          onRecall={(lot) => { setRecallRootId(lot.id); setRecallDialog('new'); }}
        />
      )}
      {view === 'trace' && <TracePanel lots={rows.lots} canManage={canManage} onLink={() => setTraceDialog(true)} onRecall={(id) => { setRecallRootId(id); setRecallDialog('new'); }} />}
      {view === 'recalls' && <RecallsTable rows={rows.recalls} loading={recalls.isPending} canManage={canManage} onEdit={setRecallDialog} />}

      {supplierDialog && (
        <SupplierDialog record={supplierDialog === 'new' ? null : supplierDialog} programId={programId} users={users} canManage={canManage} onClose={() => setSupplierDialog(null)} onSaved={() => { setSupplierDialog(null); invalidate(); }} />
      )}
      {materialDialog && (
        <MaterialDialog record={materialDialog === 'new' ? null : materialDialog} programId={programId} suppliers={rows.suppliers} canManage={canManage} onClose={() => setMaterialDialog(null)} onSaved={() => { setMaterialDialog(null); invalidate(); }} />
      )}
      {lotDialog && (
        <LotDialog record={lotDialog === 'new' ? null : lotDialog} programId={programId} suppliers={rows.suppliers} materials={rows.materials} processes={processes} canManage={canManage} onClose={() => setLotDialog(null)} onSaved={() => { setLotDialog(null); invalidate(); }} />
      )}
      {traceDialog && (
        <TraceLinkDialog lots={rows.lots} processes={processes} canManage={canManage} onClose={() => setTraceDialog(false)} onSaved={() => { setTraceDialog(false); invalidate(); }} />
      )}
      {recallDialog && (
        <RecallDialog record={recallDialog === 'new' ? null : recallDialog} programId={programId} rootLotId={recallRootId} lots={rows.lots} users={users} canManage={canManage} onClose={() => setRecallDialog(null)} onSaved={() => { setRecallDialog(null); invalidate(); }} />
      )}
    </div>
  );

  function setViewWithLot(next: ViewKey, lotId: string) {
    window.sessionStorage.setItem('g360.fsms.traceLotId', lotId);
    setView(next);
  }
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon?: React.ReactNode; tone?: 'risk' }) {
  return (
    <div className={cn('rounded-lg border bg-card p-3', tone === 'risk' && 'border-rose-200 bg-rose-50')}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={cn('mt-1 text-2xl font-semibold', tone === 'risk' && 'text-rose-700')}>{formatNumber(value)}</div>
    </div>
  );
}

function StatusBadge({ value, label }: { value: string; label: string }) {
  return <span className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_CLASS[value] ?? 'bg-slate-100 text-slate-600')}>{label}</span>;
}

function SuppliersTable({ rows, loading, canManage, onEdit }: { rows: Supplier[]; loading: boolean; canManage: boolean; onEdit: (row: Supplier) => void }) {
  return (
    <DataCard title="Fornecedores homologados e criticidade">
      <TableShell loading={loading} empty="Nenhum fornecedor cadastrado." colSpan={7}>
        {rows.map((s) => (
          <tr key={s.id}>
            <td><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.code ?? s.taxId ?? '-'}</div></td>
            <td>{s.legalName ?? '-'}</td>
            <td>{CRIT_LABEL[s.criticality]}</td>
            <td><StatusBadge value={s.status} label={SUPPLIER_STATUS_LABEL[s.status]} /></td>
            <td>{s.score != null ? formatNumber(s.score) : '-'}</td>
            <td>{s._count?.materials ?? 0} materiais</td>
            <td className="text-right"><Button variant="outline" size="sm" onClick={() => onEdit(s)}>{canManage ? 'Editar' : 'Ver'}</Button></td>
          </tr>
        ))}
      </TableShell>
    </DataCard>
  );
}

function MaterialsTable({ rows, loading, canManage, onEdit }: { rows: Material[]; loading: boolean; canManage: boolean; onEdit: (row: Material) => void }) {
  return (
    <DataCard title="Materias-primas e materiais de embalagem">
      <TableShell loading={loading} empty="Nenhum material cadastrado." colSpan={7}>
        {rows.map((m) => (
          <tr key={m.id}>
            <td><div className="font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{m.code ?? '-'}</div></td>
            <td>{MATERIAL_CATEGORY_LABEL[m.category]}</td>
            <td>{m.supplier?.name ?? '-'}</td>
            <td>{m.allergens ?? '-'}</td>
            <td><StatusBadge value={m.status} label={MATERIAL_STATUS_LABEL[m.status]} /></td>
            <td>{m._count?.lots ?? 0} lotes</td>
            <td className="text-right"><Button variant="outline" size="sm" onClick={() => onEdit(m)}>{canManage ? 'Editar' : 'Ver'}</Button></td>
          </tr>
        ))}
      </TableShell>
    </DataCard>
  );
}

function LotsTable({
  rows,
  loading,
  canManage,
  onEdit,
  onTrace,
  onRecall,
}: {
  rows: Lot[];
  loading: boolean;
  canManage: boolean;
  onEdit: (row: Lot) => void;
  onTrace: (row: Lot) => void;
  onRecall: (row: Lot) => void;
}) {
  return (
    <DataCard title="Lotes recebidos, produzidos e expedidos">
      <TableShell loading={loading} empty="Nenhum lote cadastrado." colSpan={8}>
        {rows.map((l) => (
          <tr key={l.id}>
            <td><div className="font-medium">{l.code}</div><div className="text-xs text-muted-foreground">{LOT_TYPE_LABEL[l.type]}</div></td>
            <td>{l.material?.name ?? '-'}</td>
            <td>{l.supplier?.name ?? '-'}</td>
            <td>{l.quantity != null ? `${formatNumber(l.quantity)} ${l.unit ?? ''}` : '-'}</td>
            <td><StatusBadge value={l.status} label={LOT_STATUS_LABEL[l.status]} /></td>
            <td className="text-xs">{l.expiresAt ? formatDate(l.expiresAt) : '-'}</td>
            <td className="text-xs">{(l._count?.incomingTraceLinks ?? 0) + (l._count?.outgoingTraceLinks ?? 0)} vinculos</td>
            <td className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onTrace(l)}>Rastrear</Button>
                {canManage && <Button variant="outline" size="sm" onClick={() => onRecall(l)}>Recall</Button>}
                <Button variant="outline" size="sm" onClick={() => onEdit(l)}>{canManage ? 'Editar' : 'Ver'}</Button>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
    </DataCard>
  );
}

function RecallsTable({ rows, loading, canManage, onEdit }: { rows: Recall[]; loading: boolean; canManage: boolean; onEdit: (row: Recall) => void }) {
  return (
    <DataCard title="Simulacoes e recalls">
      <TableShell loading={loading} empty="Nenhum recall registrado." colSpan={7}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><div className="font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{r.code ?? r.rootLot?.code ?? '-'}</div></td>
            <td>{CRIT_LABEL[r.severity]}</td>
            <td><StatusBadge value={r.status} label={RECALL_STATUS_LABEL[r.status]} /></td>
            <td>{r.items?.length ?? 0} lotes</td>
            <td>{r.affectedQuantity != null ? `${formatNumber(r.affectedQuantity)} ${r.unit ?? ''}` : '-'}</td>
            <td className="text-xs">{r.initiatedAt ? formatDate(r.initiatedAt) : '-'}</td>
            <td className="text-right"><Button variant="outline" size="sm" onClick={() => onEdit(r)}>{canManage ? 'Editar' : 'Ver'}</Button></td>
          </tr>
        ))}
      </TableShell>
    </DataCard>
  );
}

function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-3 text-sm font-semibold">{title}</div>
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

function TableShell({ loading, empty, colSpan, children }: { loading: boolean; empty: string; colSpan: number; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <table className="table-modern">
      <thead>
        <tr>
          <th className="text-left">Registro</th>
          <th className="text-left">Detalhe</th>
          <th className="text-left">Origem</th>
          <th className="text-left">Qtd/Score</th>
          <th className="text-left">Status</th>
          <th className="text-left">Vinculos</th>
          <th className="text-right">Acoes</th>
        </tr>
      </thead>
      <tbody>
        {loading ? <tr><td colSpan={colSpan} className="p-6 text-center text-sm text-muted-foreground">Carregando...</td></tr> : hasRows ? children : <tr><td colSpan={colSpan} className="p-6 text-center text-sm text-muted-foreground">{empty}</td></tr>}
      </tbody>
    </table>
  );
}

function TracePanel({ lots, canManage, onLink, onRecall }: { lots: Lot[]; canManage: boolean; onLink: () => void; onRecall: (lotId: string) => void }) {
  const [lotId, setLotId] = useState('');
  useEffect(() => {
    const remembered = typeof window !== 'undefined' ? window.sessionStorage.getItem('g360.fsms.traceLotId') : '';
    const initial = remembered && lots.some((l) => l.id === remembered) ? remembered : lots[0]?.id ?? '';
    if (!lotId && initial) setLotId(initial);
  }, [lots, lotId]);
  const trace = useQuery<TraceResult>({ queryKey: ['fsms', 'trace', lotId], queryFn: () => api(`/food-safety/lots/${lotId}/trace?depth=5`), enabled: !!lotId });
  const root = lots.find((l) => l.id === lotId);
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label>Lote</Label>
            <NativeSelect className="w-64" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {lots.map((l) => <option key={l.id} value={l.id}>{l.code} - {l.material?.name ?? LOT_TYPE_LABEL[l.type]}</option>)}
            </NativeSelect>
          </div>
          {canManage && <Button variant="outline" onClick={onLink}><Link2 className="mr-2 h-4 w-4" />Novo vinculo</Button>}
          {canManage && root && <Button onClick={() => onRecall(root.id)}><RefreshCw className="mr-2 h-4 w-4" />Simular recall</Button>}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TraceColumn title="Para tras" rows={trace.data?.backward ?? []} direction="backward" loading={trace.isPending} />
        <TraceColumn title="Para frente" rows={trace.data?.forward ?? []} direction="forward" loading={trace.isPending} />
      </div>
      {trace.data && (
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          Lotes impactados na simulacao: <span className="font-semibold">{trace.data.impactedLotIds.length}</span>
        </div>
      )}
    </div>
  );
}

function TraceColumn({ title, rows, direction, loading }: { title: string; rows: Array<{ depth: number; link: TraceLink }>; direction: 'backward' | 'forward'; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-3 text-sm font-semibold">{title}</div>
        <div className="space-y-2 p-3">
          {loading ? <div className="text-sm text-muted-foreground">Carregando...</div> : rows.length === 0 ? <div className="text-sm text-muted-foreground">Sem vinculos.</div> : rows.map(({ depth, link }) => {
            const lot = direction === 'backward' ? link.fromLot : link.toLot;
            return (
              <div key={link.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{lotLabel(lot)}</div>
                  <Badge variant="outline">nivel {depth}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{TRACE_EVENT_LABEL[link.eventType]}{link.process ? ` - ${link.process.name}` : ''}{link.quantity != null ? ` - ${formatNumber(link.quantity)} ${link.unit ?? ''}` : ''}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function lotLabel(lot: Lot | null) {
  if (!lot) return '-';
  return `${lot.code}${lot.material?.name ? ` - ${lot.material.name}` : ''}`;
}

function SupplierDialog({ record, programId, users, canManage, onClose, onSaved }: { record: Supplier | null; programId: string; users: UserRef[]; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: record?.code ?? '',
    name: record?.name ?? '',
    legalName: record?.legalName ?? '',
    taxId: record?.taxId ?? '',
    contactName: record?.contactName ?? '',
    contactEmail: record?.contactEmail ?? '',
    criticality: record?.criticality ?? ('MEDIUM' as SupplierCriticality),
    status: record?.status ?? ('PROSPECT' as SupplierStatus),
    score: record?.score != null ? String(record.score) : '',
    documentsStatus: record?.documentsStatus ?? '',
    nextReviewAt: record?.nextReviewAt ? record.nextReviewAt.slice(0, 10) : '',
    responsibleUserId: record?.responsibleUserId ?? '',
    suppliedCategories: record?.suppliedCategories ?? '',
    notes: '',
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, programId, code: form.code || null, legalName: form.legalName || null, taxId: form.taxId || null, contactName: form.contactName || null, contactEmail: form.contactEmail || null, score: form.score || null, documentsStatus: form.documentsStatus || null, nextReviewAt: form.nextReviewAt || null, responsibleUserId: form.responsibleUserId || null, suppliedCategories: form.suppliedCategories || null, notes: form.notes || null };
      return record ? api(`/food-safety/suppliers/${record.id}`, { method: 'PATCH', json: payload }) : api('/food-safety/suppliers', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success('Fornecedor salvo'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar fornecedor'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Fornecedor' : 'Novo fornecedor'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>Codigo</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!canManage} /></div>
          <div><Label className="field-required">Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Razao social</Label><Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} disabled={!canManage} /></div>
          <div><Label>CNPJ/ID</Label><Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Contato</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Email</Label><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Criticidade</Label><NativeSelect value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value as SupplierCriticality })} disabled={!canManage}>{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as SupplierCriticality[]).map((x) => <option key={x} value={x}>{CRIT_LABEL[x]}</option>)}</NativeSelect></div>
          <div><Label>Status</Label><NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SupplierStatus })} disabled={!canManage}>{(['PROSPECT', 'APPROVED', 'CONDITIONAL', 'BLOCKED', 'INACTIVE'] as SupplierStatus[]).map((x) => <option key={x} value={x}>{SUPPLIER_STATUS_LABEL[x]}</option>)}</NativeSelect></div>
          <div><Label>Score</Label><Input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Proxima revisao</Label><Input type="date" value={form.nextReviewAt} onChange={(e) => setForm({ ...form, nextReviewAt: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Responsavel</Label><NativeSelect value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })} disabled={!canManage}><option value="">-</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect></div>
          <div><Label>Status documental</Label><Input value={form.documentsStatus} onChange={(e) => setForm({ ...form, documentsStatus: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Categorias fornecidas</Label><Input value={form.suppliedCategories} onChange={(e) => setForm({ ...form, suppliedCategories: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Notas</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={!canManage} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button>{canManage && <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaterialDialog({ record, programId, suppliers, canManage, onClose, onSaved }: { record: Material | null; programId: string; suppliers: Supplier[]; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: record?.code ?? '',
    name: record?.name ?? '',
    category: record?.category ?? ('RAW_MATERIAL' as MaterialCategory),
    supplierId: record?.supplierId ?? '',
    unit: record?.unit ?? '',
    specification: record?.specification ?? '',
    storageCondition: record?.storageCondition ?? '',
    allergens: record?.allergens ?? '',
    hazards: record?.hazards ?? '',
    requiredDocuments: record?.requiredDocuments ?? '',
    shelfLifeDays: record?.shelfLifeDays != null ? String(record.shelfLifeDays) : '',
    status: record?.status ?? ('ACTIVE' as MaterialStatus),
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, programId, code: form.code || null, supplierId: form.supplierId || null, unit: form.unit || null, specification: form.specification || null, storageCondition: form.storageCondition || null, allergens: form.allergens || null, hazards: form.hazards || null, requiredDocuments: form.requiredDocuments || null, shelfLifeDays: form.shelfLifeDays || null };
      return record ? api(`/food-safety/materials/${record.id}`, { method: 'PATCH', json: payload }) : api('/food-safety/materials', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success('Material salvo'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar material'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Material' : 'Novo material'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>Codigo</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!canManage} /></div>
          <div><Label className="field-required">Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Categoria</Label><NativeSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MaterialCategory })} disabled={!canManage}>{Object.entries(MATERIAL_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>
          <div><Label>Fornecedor</Label><NativeSelect value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} disabled={!canManage}><option value="">-</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></div>
          <div><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Status</Label><NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MaterialStatus })} disabled={!canManage}>{Object.entries(MATERIAL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>
          <div><Label>Vida util (dias)</Label><Input type="number" value={form.shelfLifeDays} onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Alergenicos</Label><Input value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Especificacao</Label><Textarea rows={2} value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Condicao de armazenamento</Label><Input value={form.storageCondition} onChange={(e) => setForm({ ...form, storageCondition: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Perigos associados</Label><Input value={form.hazards} onChange={(e) => setForm({ ...form, hazards: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Documentos obrigatorios</Label><Input value={form.requiredDocuments} onChange={(e) => setForm({ ...form, requiredDocuments: e.target.value })} disabled={!canManage} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button>{canManage && <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LotDialog({ record, programId, suppliers, materials, processes, canManage, onClose, onSaved }: { record: Lot | null; programId: string; suppliers: Supplier[]; materials: Material[]; processes: ProcessRef[]; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: record?.code ?? '',
    type: record?.type ?? ('RECEIVED' as LotType),
    status: record?.status ?? ('QUARANTINED' as LotStatus),
    materialId: record?.materialId ?? '',
    supplierId: record?.supplierId ?? '',
    processId: record?.processId ?? '',
    quantity: record?.quantity != null ? String(record.quantity) : '',
    unit: record?.unit ?? '',
    receivedAt: record?.receivedAt ? record.receivedAt.slice(0, 10) : '',
    producedAt: record?.producedAt ? record.producedAt.slice(0, 10) : '',
    expiresAt: record?.expiresAt ? record.expiresAt.slice(0, 10) : '',
    storageLocation: record?.storageLocation ?? '',
    customerName: record?.customerName ?? '',
    destination: record?.destination ?? '',
    notes: record?.notes ?? '',
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, programId, materialId: form.materialId || null, supplierId: form.supplierId || null, processId: form.processId || null, quantity: form.quantity || null, unit: form.unit || null, receivedAt: form.receivedAt || null, producedAt: form.producedAt || null, expiresAt: form.expiresAt || null, storageLocation: form.storageLocation || null, customerName: form.customerName || null, destination: form.destination || null, notes: form.notes || null };
      return record ? api(`/food-safety/lots/${record.id}`, { method: 'PATCH', json: payload }) : api('/food-safety/lots', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success('Lote salvo'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar lote'),
  });
  const selectedMaterial = materials.find((m) => m.id === form.materialId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Lote' : 'Novo lote'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label className="field-required">Codigo do lote</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Tipo</Label><NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LotType })} disabled={!canManage}>{Object.entries(LOT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>
          <div><Label>Status</Label><NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LotStatus })} disabled={!canManage}>{Object.entries(LOT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>
          <div><Label>Material</Label><NativeSelect value={form.materialId} onChange={(e) => { const mat = materials.find((m) => m.id === e.target.value); setForm({ ...form, materialId: e.target.value, supplierId: form.supplierId || mat?.supplierId || '', unit: form.unit || mat?.unit || '' }); }} disabled={!canManage}><option value="">-</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect></div>
          <div><Label>Fornecedor</Label><NativeSelect value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} disabled={!canManage}><option value="">-</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></div>
          <div><Label>Processo</Label><NativeSelect value={form.processId} onChange={(e) => setForm({ ...form, processId: e.target.value })} disabled={!canManage}><option value="">-</option>{processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></div>
          <div><Label>Quantidade</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!canManage} placeholder={selectedMaterial?.unit ?? ''} /></div>
          <div><Label>Recebido em</Label><Input type="date" value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Produzido em</Label><Input type="date" value={form.producedAt} onChange={(e) => setForm({ ...form, producedAt: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Validade</Label><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Local</Label><Input value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Cliente</Label><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Destino</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Notas</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={!canManage} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button>{canManage && <Button disabled={!form.code.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TraceLinkDialog({ lots, processes, canManage, onClose, onSaved }: { lots: Lot[]; processes: ProcessRef[]; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    fromLotId: lots[0]?.id ?? '',
    toLotId: lots[1]?.id ?? '',
    processId: '',
    stepId: '',
    eventType: 'PRODUCTION' as TraceEventType,
    quantity: '',
    unit: '',
    occurredAt: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const selectedProcess = processes.find((p) => p.id === form.processId);
  const save = useMutation({
    mutationFn: () => api('/food-safety/trace-links', { method: 'POST', json: { ...form, fromLotId: form.fromLotId || null, toLotId: form.toLotId || null, processId: form.processId || null, stepId: form.stepId || null, quantity: form.quantity || null, unit: form.unit || null, occurredAt: form.occurredAt || null, notes: form.notes || null } }),
    onSuccess: () => { toast.success('Vinculo de rastreabilidade salvo'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar vinculo'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Vinculo de rastreabilidade</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>Lote origem</Label><NativeSelect value={form.fromLotId} onChange={(e) => setForm({ ...form, fromLotId: e.target.value })} disabled={!canManage}><option value="">-</option>{lots.map((l) => <option key={l.id} value={l.id}>{lotLabel(l)}</option>)}</NativeSelect></div>
          <div><Label>Lote destino</Label><NativeSelect value={form.toLotId} onChange={(e) => setForm({ ...form, toLotId: e.target.value })} disabled={!canManage}><option value="">-</option>{lots.map((l) => <option key={l.id} value={l.id}>{lotLabel(l)}</option>)}</NativeSelect></div>
          <div><Label>Evento</Label><NativeSelect value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as TraceEventType })} disabled={!canManage}>{Object.entries(TRACE_EVENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>
          <div><Label>Processo</Label><NativeSelect value={form.processId} onChange={(e) => setForm({ ...form, processId: e.target.value, stepId: '' })} disabled={!canManage}><option value="">-</option>{processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></div>
          <div><Label>Etapa</Label><NativeSelect value={form.stepId} onChange={(e) => setForm({ ...form, stepId: e.target.value })} disabled={!canManage || !selectedProcess}><option value="">-</option>{(selectedProcess?.steps ?? []).map((s) => <option key={s.id} value={s.id}>{s.number}. {s.name}</option>)}</NativeSelect></div>
          <div><Label>Data</Label><Input type="date" value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Quantidade</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Notas</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={!canManage} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button>{canManage && <Button disabled={(!form.fromLotId && !form.toLotId) || form.fromLotId === form.toLotId || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecallDialog({ record, programId, rootLotId, lots, users, canManage, onClose, onSaved }: { record: Recall | null; programId: string; rootLotId: string; lots: Lot[]; users: UserRef[]; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: record?.code ?? '',
    title: record?.title ?? '',
    rootLotId: record?.rootLotId ?? rootLotId,
    severity: record?.severity ?? ('MEDIUM' as RecallSeverity),
    status: record?.status ?? ('SIMULATION' as RecallStatus),
    reason: record?.reason ?? '',
    scopeDescription: record?.scopeDescription ?? '',
    affectedQuantity: record?.affectedQuantity != null ? String(record.affectedQuantity) : '',
    unit: record?.unit ?? '',
    responsibleUserId: record?.responsibleUserId ?? '',
    actions: record?.actions ?? '',
    notes: record?.notes ?? '',
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, programId, code: form.code || null, rootLotId: form.rootLotId || null, reason: form.reason || null, scopeDescription: form.scopeDescription || null, affectedQuantity: form.affectedQuantity || null, unit: form.unit || null, responsibleUserId: form.responsibleUserId || null, actions: form.actions || null, notes: form.notes || null };
      return record ? api(`/food-safety/recalls/${record.id}`, { method: 'PATCH', json: payload }) : api('/food-safety/recalls', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success(record ? 'Recall atualizado' : 'Simulacao de recall criada'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar recall'),
  });
  const title = form.title.trim() || (form.rootLotId ? `Recall ${lots.find((l) => l.id === form.rootLotId)?.code ?? ''}` : '');
  useEffect(() => {
    if (!record && !form.title && title) setForm((current) => ({ ...current, title }));
  }, [record, form.title, title]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Recall' : 'Nova simulacao de recall'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>Codigo</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Lote raiz</Label><NativeSelect value={form.rootLotId} onChange={(e) => setForm({ ...form, rootLotId: e.target.value })} disabled={!canManage || !!record}><option value="">-</option>{lots.map((l) => <option key={l.id} value={l.id}>{lotLabel(l)}</option>)}</NativeSelect></div>
          <div className="md:col-span-2"><Label className="field-required">Titulo</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Severidade</Label><NativeSelect value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as RecallSeverity })} disabled={!canManage}>{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as RecallSeverity[]).map((x) => <option key={x} value={x}>{CRIT_LABEL[x]}</option>)}</NativeSelect></div>
          <div><Label>Status</Label><NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RecallStatus })} disabled={!canManage}>{Object.entries(RECALL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>
          <div><Label>Qtd. afetada</Label><Input type="number" value={form.affectedQuantity} onChange={(e) => setForm({ ...form, affectedQuantity: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Responsavel</Label><NativeSelect value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })} disabled={!canManage}><option value="">-</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect></div>
          <div className="md:col-span-2"><Label>Motivo</Label><Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Escopo</Label><Textarea rows={2} value={form.scopeDescription} onChange={(e) => setForm({ ...form, scopeDescription: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Acoes</Label><Textarea rows={2} value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} disabled={!canManage} /></div>
        </div>
        {record?.items?.length ? (
          <div className="mt-3 rounded-md border">
            <div className="border-b p-2 text-sm font-semibold">Lotes no recall</div>
            <div className="max-h-48 overflow-y-auto">
              {record.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b p-2 text-sm last:border-b-0">
                  <span>{lotLabel(item.lot)}</span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button>{canManage && <Button disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
