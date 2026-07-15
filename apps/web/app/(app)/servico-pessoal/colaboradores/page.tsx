'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarClock,
  Clock,
  Download,
  FileUp,
  FolderOpen,
  History,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api, getAccessToken } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';

interface EmployeeRow {
  id: string;
  registrationId: string | null;
  name: string;
  status: string;
  orgNode: { id: string; name: string } | null;
  job: { id: string; name: string; cbo?: string | null } | null;
  cpfMasked: string | null;
  admissionDate: string | null;
  terminationDate: string | null;
  contractType: string | null;
  phone: string | null;
  hasUserLink: boolean;
  profileComplete: boolean;
}

interface ListResponse {
  items: EmployeeRow[];
  kpis: { active: number; inactive: number; missingProfile: number; admittedThisMonth: number };
}

interface Options {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  jobs: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  contractTypes: string[];
  workRegimes: string[];
  dependentRelationships: string[];
  dossierKinds: string[];
}

interface EmployeeDetail {
  id: string;
  registrationId: string | null;
  name: string;
  status: string;
  orgNodeId: string | null;
  jobId: string;
  orgNode: { id: string; name: string } | null;
  job: { id: string; name: string; cbo?: string | null } | null;
  personnelProfile: Record<string, any> | null;
  linkedUser: { id: string; name: string; email: string; active: boolean } | null;
  dependents: Array<{ id: string; name: string; relationship: string; birthDate: string | null; cpf: string | null; isIrDependent: boolean }>;
  employmentEvents: Array<{ id: string; type: string; title: string; description: string | null; effectiveDate: string; createdAt: string }>;
  dossierFiles: Array<{ id: string; kind: string; name: string; fileName: string; sizeBytes: number | null; validUntil: string | null; note: string | null; createdAt: string }>;
}

const CONTRACT_LABEL: Record<string, string> = {
  CLT: 'CLT', PJ: 'PJ', ESTAGIO: 'Estágio', APRENDIZ: 'Aprendiz', TEMPORARIO: 'Temporário', AUTONOMO: 'Autônomo',
};
const REGIME_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', HIBRIDO: 'Híbrido', REMOTO: 'Remoto' };
const RELATIONSHIP_LABEL: Record<string, string> = { FILHO: 'Filho(a)', CONJUGE: 'Cônjuge', PAI: 'Pai', MAE: 'Mãe', OUTRO: 'Outro' };
const KIND_LABEL: Record<string, string> = {
  CPF: 'CPF', RG: 'RG', CTPS: 'CTPS', COMPROVANTE_RESIDENCIA: 'Comprovante de residência', CONTRATO: 'Contrato',
  ASO: 'ASO', CERTIFICADO: 'Certificado', FOTO: 'Foto', OUTRO: 'Outro',
};
const EVENT_LABEL: Record<string, string> = {
  ADMISSAO: 'Admissão', PROMOCAO: 'Promoção', MUDANCA_CARGO: 'Mudança de cargo', TRANSFERENCIA: 'Transferência',
  MUDANCA_STATUS: 'Mudança de status', DESLIGAMENTO: 'Desligamento', OBSERVACAO: 'Observação', OUTRO: 'Outro',
};

// Cabeçalhos aceitos no import (PT/EN) -> campo da linha normalizada.
const HEADER_ALIASES: Record<string, string> = {
  nome: 'name', colaborador: 'name', name: 'name',
  matricula: 'registrationId', 'matrícula': 'registrationId', registro: 'registrationId', registrationid: 'registrationId',
  cpf: 'cpf',
  email: 'email', 'e-mail': 'email', usuario: 'email', 'usuário': 'email',
  cargo: 'jobName', funcao: 'jobName', 'função': 'jobName', jobname: 'jobName',
  area: 'orgNodeName', 'área': 'orgNodeName', setor: 'orgNodeName', departamento: 'orgNodeName', orgnodename: 'orgNodeName',
  admissao: 'admissionDate', 'admissão': 'admissionDate', 'data de admissao': 'admissionDate', 'data de admissão': 'admissionDate', admissiondate: 'admissionDate',
  nascimento: 'birthDate', 'data de nascimento': 'birthDate', birthdate: 'birthDate',
  telefone: 'phone', celular: 'phone', phone: 'phone',
  'email pessoal': 'personalEmail', personalemail: 'personalEmail',
  contrato: 'contractType', 'tipo de contrato': 'contractType', contracttype: 'contractType',
};

const EMPTY_FORM = {
  name: '', registrationId: '', jobId: '', jobName: '', orgNodeId: '',
  cpf: '', rg: '', pisPasep: '', ctpsNumber: '', birthDate: '', phone: '', personalEmail: '',
  address: '', city: '', state: '', zipCode: '', maritalStatus: '', educationLevel: '',
  sex: '', raceColor: '', cbo: '',
  bankCode: '', bankAgency: '', bankAccount: '', bankAccountDigit: '', pixKey: '',
  contractType: '', workRegime: '', admissionDate: '', userId: '',
  emergencyContactName: '', emergencyContactPhone: '', notes: '',
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['pessoal:create', 'pessoal:manage']);
  const canUpdate = hasPermission(['pessoal:update', 'pessoal:manage']);
  const canImport = hasPermission(['pessoal:manage']);

  const [filters, setFilters] = useState({ search: '', orgNodeId: '', status: '' });
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [dependentForm, setDependentForm] = useState({ name: '', relationship: 'FILHO', birthDate: '', cpf: '', isIrDependent: false });
  const [eventForm, setEventForm] = useState({ title: '', description: '', effectiveDate: '' });
  const [fileForm, setFileForm] = useState({ kind: 'OUTRO', name: '', validUntil: '' });
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const listQuery = useQuery<ListResponse>({
    queryKey: ['personnel-employees', filters],
    queryFn: () => api<ListResponse>(`/personnel/employees${toQuery(filters)}`),
  });
  const optionsQuery = useQuery<Options>({
    queryKey: ['personnel-employees', 'options'],
    queryFn: () => api<Options>('/personnel/employees/options'),
    staleTime: 60_000,
  });
  const detailQuery = useQuery<EmployeeDetail>({
    queryKey: ['personnel-employees', 'detail', detailId],
    queryFn: () => api<EmployeeDetail>(`/personnel/employees/${detailId}`),
    enabled: Boolean(detailId),
  });

  const options = optionsQuery.data;
  const detail = detailQuery.data ?? null;
  const kpis = listQuery.data?.kpis;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['personnel-employees'] });
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        registrationId: form.registrationId || null,
        jobId: form.jobId || undefined,
        jobName: form.jobId ? undefined : form.jobName || undefined,
        orgNodeId: form.orgNodeId || null,
        profile: {
          cpf: form.cpf || null,
          rg: form.rg || null,
          pisPasep: form.pisPasep || null,
          ctpsNumber: form.ctpsNumber || null,
          birthDate: form.birthDate || null,
          phone: form.phone || null,
          personalEmail: form.personalEmail || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zipCode: form.zipCode || null,
          maritalStatus: form.maritalStatus || null,
          educationLevel: form.educationLevel || null,
          sex: form.sex || null,
          raceColor: form.raceColor || null,
          cbo: form.cbo || null,
          bankCode: form.bankCode || null,
          bankAgency: form.bankAgency || null,
          bankAccount: form.bankAccount || null,
          bankAccountDigit: form.bankAccountDigit || null,
          pixKey: form.pixKey || null,
          contractType: form.contractType || null,
          workRegime: form.workRegime || null,
          admissionDate: form.admissionDate || null,
          userId: form.userId || null,
          emergencyContactName: form.emergencyContactName || null,
          emergencyContactPhone: form.emergencyContactPhone || null,
          notes: form.notes || null,
        },
      };
      return editingId
        ? api<EmployeeDetail>(`/personnel/employees/${editingId}`, { method: 'PATCH', json: payload })
        : api<EmployeeDetail>('/personnel/employees', { method: 'POST', json: payload });
    },
    onSuccess: (employee) => {
      toast.success(editingId ? 'Prontuário atualizado' : 'Colaborador cadastrado');
      setFormOpen(false);
      setDetailId(employee.id);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar o colaborador'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api(`/personnel/employees/${id}`, { method: 'PATCH', json: { status, reason } }),
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'INACTIVE' ? 'Colaborador desligado' : 'Colaborador reativado');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível alterar o status'),
  });

  const addDependent = useMutation({
    mutationFn: () => api(`/personnel/employees/${detailId}/dependents`, { method: 'POST', json: dependentForm }),
    onSuccess: () => {
      toast.success('Dependente adicionado');
      setDependentForm({ name: '', relationship: 'FILHO', birthDate: '', cpf: '', isIrDependent: false });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível adicionar o dependente'),
  });

  const removeDependent = useMutation({
    mutationFn: (dependentId: string) => api(`/personnel/employees/${detailId}/dependents/${dependentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Dependente removido');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível remover o dependente'),
  });

  const addEvent = useMutation({
    mutationFn: () => api(`/personnel/employees/${detailId}/events`, { method: 'POST', json: { ...eventForm, type: 'OBSERVACAO' } }),
    onSuccess: () => {
      toast.success('Registro adicionado à linha do tempo');
      setEventForm({ title: '', description: '', effectiveDate: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar o evento'),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await readAsBase64(file);
      return api(`/personnel/employees/${detailId}/files`, {
        method: 'POST',
        json: {
          kind: fileForm.kind,
          name: fileForm.name || file.name,
          fileName: file.name,
          mimeType: file.type || undefined,
          contentBase64: base64,
          validUntil: fileForm.validUntil || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('Documento anexado ao dossiê');
      setFileForm({ kind: 'OUTRO', name: '', validUntil: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível anexar o documento'),
  });

  const removeFile = useMutation({
    mutationFn: (fileId: string) => api(`/personnel/employees/${detailId}/files/${fileId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Documento removido do dossiê');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível remover o documento'),
  });

  const runImport = useMutation({
    mutationFn: () => api<{ created: number; updated: number; errors: string[] }>('/personnel/employees/import', { method: 'POST', json: { rows: importRows } }),
    onSuccess: (result) => {
      setImportResult(result);
      toast.success(`${result.created} criado(s), ${result.updated} atualizado(s)`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível importar'),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (employee: EmployeeDetail) => {
    const profile = employee.personnelProfile ?? {};
    setEditingId(employee.id);
    setForm({
      name: employee.name,
      registrationId: employee.registrationId ?? '',
      jobId: employee.jobId ?? '',
      jobName: '',
      orgNodeId: employee.orgNodeId ?? '',
      cpf: profile.cpf ?? '',
      rg: profile.rg ?? '',
      pisPasep: profile.pisPasep ?? '',
      ctpsNumber: profile.ctpsNumber ?? '',
      birthDate: toInputDate(profile.birthDate),
      phone: profile.phone ?? '',
      personalEmail: profile.personalEmail ?? '',
      address: profile.address ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      zipCode: profile.zipCode ?? '',
      maritalStatus: profile.maritalStatus ?? '',
      educationLevel: profile.educationLevel ?? '',
      sex: profile.sex ?? '',
      raceColor: profile.raceColor ?? '',
      cbo: employee.job?.cbo ?? '',
      bankCode: profile.bankCode ?? '',
      bankAgency: profile.bankAgency ?? '',
      bankAccount: profile.bankAccount ?? '',
      bankAccountDigit: profile.bankAccountDigit ?? '',
      pixKey: profile.pixKey ?? '',
      contractType: profile.contractType ?? '',
      workRegime: profile.workRegime ?? '',
      admissionDate: toInputDate(profile.admissionDate),
      userId: profile.userId ?? '',
      emergencyContactName: profile.emergencyContactName ?? '',
      emergencyContactPhone: profile.emergencyContactPhone ?? '',
      notes: profile.notes ?? '',
    });
    setFormOpen(true);
  };

  async function handleImportFile(file: File | null) {
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const rows = json
        .map((raw) => {
          const mapped: Record<string, string> = {};
          for (const [key, value] of Object.entries(raw)) {
            const field = HEADER_ALIASES[key.trim().toLowerCase()];
            if (field && value != null && String(value).trim()) mapped[field] = String(value).trim();
          }
          return mapped;
        })
        .filter((row) => Object.keys(row).length > 0);
      if (!rows.length) {
        toast.error('Nenhuma linha reconhecida. Confira os cabeçalhos (nome, cpf, cargo, área, admissão...).');
        return;
      }
      setImportRows(rows);
      setImportResult(null);
    } catch {
      toast.error('Não foi possível ler o arquivo (CSV/XLSX).');
    }
  }

  const items = listQuery.data?.items ?? [];
  const profileFields = useMemo(() => detail?.personnelProfile ?? {}, [detail]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colaboradores"
        description="Cadastro do quadro, prontuário 360°, dependentes, dossiê digital e linha do tempo do vínculo."
        actions={
          <div className="flex gap-2">
            {canImport && (
              <Button variant="outline" onClick={() => { setImportRows([]); setImportResult(null); setImportOpen(true); }}>
                <FileUp className="mr-1.5 h-4 w-4" />Importar
              </Button>
            )}
            {canCreate && (
              <Button onClick={openCreate} className="bg-blue-600 font-semibold text-white hover:bg-blue-700">
                <UserPlus className="mr-1.5 h-4 w-4" />Novo colaborador
              </Button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="Ativos" value={kpis?.active ?? 0} icon={Users} color="emerald" />
        <KpiCard title="Desligados" value={kpis?.inactive ?? 0} icon={UserMinus} color="rose" />
        <KpiCard title="Cadastro incompleto" value={kpis?.missingProfile ?? 0} icon={FolderOpen} color="amber" />
        <KpiCard title="Admitidos no mês" value={kpis?.admittedThisMonth ?? 0} icon={UserCheck} color="sky" />
      </div>

      {/* Filtros + tabela */}
      <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, matrícula ou CPF..."
              className="h-8 w-64 pl-7 text-xs"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <NativeSelect className="h-8 w-48 text-xs" value={filters.orgNodeId} onChange={(e) => setFilters((f) => ({ ...f, orgNodeId: e.target.value }))}>
            <option value="">Todas as áreas</option>
            {(options?.orgNodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </NativeSelect>
          <NativeSelect className="h-8 w-36 text-xs" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Desligados</option>
          </NativeSelect>
          <span className="ml-auto text-xs text-muted-foreground">{items.length} colaborador(es)</span>
        </div>
        <CardContent className="overflow-x-auto p-0">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {listQuery.isLoading ? 'Carregando colaboradores...' : 'Nenhum colaborador encontrado. Cadastre o primeiro ou use a importação.'}
            </div>
          ) : (
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                <tr>
                  <th className="px-4 py-2.5 text-left">Matrícula</th>
                  <th className="px-2 py-2.5 text-left">Colaborador</th>
                  <th className="px-2 py-2.5 text-left">Cargo</th>
                  <th className="px-2 py-2.5 text-left">Área</th>
                  <th className="px-2 py-2.5 text-left">CPF</th>
                  <th className="px-2 py-2.5 text-left">Admissão</th>
                  <th className="px-2 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {items.map((employee) => (
                  <tr key={employee.id} className="cursor-pointer transition-colors hover:bg-sky-50/40 dark:hover:bg-slate-900/50" onClick={() => setDetailId(employee.id)}>
                    <td className="px-4 py-2.5 font-mono text-xs">{employee.registrationId ?? '—'}</td>
                    <td className="max-w-[240px] px-2 py-2.5">
                      <div className="truncate font-medium text-slate-800 dark:text-slate-200">{employee.name}</div>
                      {!employee.profileComplete && <span className="text-[10px] text-status-yellow">cadastro incompleto</span>}
                    </td>
                    <td className="max-w-[160px] truncate px-2 py-2.5 text-xs">{employee.job?.name ?? '—'}</td>
                    <td className="max-w-[140px] truncate px-2 py-2.5 text-xs">{employee.orgNode?.name ?? '—'}</td>
                    <td className="px-2 py-2.5 text-xs tabular-nums">{employee.cpfMasked ?? '—'}</td>
                    <td className="px-2 py-2.5 text-xs tabular-nums">{formatDate(employee.admissionDate)}</td>
                    <td className="px-2 py-2.5">
                      <Badge variant="outline" className={employee.status === 'ACTIVE' ? 'border-status-green/40 text-status-green' : 'border-status-red/40 text-status-red'}>
                        {employee.status === 'ACTIVE' ? 'Ativo' : 'Desligado'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDetailId(employee.id)}>Prontuário</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: novo/editar colaborador */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[92vh]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar prontuário' : 'Novo colaborador'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basico">
            <TabsList className="bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="basico">Dados básicos</TabsTrigger>
              <TabsTrigger value="contratuais">Contratuais</TabsTrigger>
              <TabsTrigger value="contato">Contato & Endereço</TabsTrigger>
            </TabsList>
            <TabsContent value="basico" className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nome completo *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Matrícula</Label>
                <Input value={form.registrationId} onChange={(e) => setForm((f) => ({ ...f, registrationId: e.target.value }))} />
              </div>
              <div>
                <Label>CPF</Label>
                <Input placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
              </div>
              <div>
                <Label>RG</Label>
                <Input value={form.rg} onChange={(e) => setForm((f) => ({ ...f, rg: e.target.value }))} />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
              </div>
              <div>
                <Label>Estado civil</Label>
                <Input value={form.maritalStatus} onChange={(e) => setForm((f) => ({ ...f, maritalStatus: e.target.value }))} />
              </div>
              <div>
                <Label>Escolaridade</Label>
                <Input value={form.educationLevel} onChange={(e) => setForm((f) => ({ ...f, educationLevel: e.target.value }))} />
              </div>
              <div>
                <Label>Sexo <span className="text-[10px] text-muted-foreground">(eSocial)</span></Label>
                <NativeSelect value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}>
                  <option value="">Não informado</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </NativeSelect>
              </div>
              <div>
                <Label>Raça/cor <span className="text-[10px] text-muted-foreground">(eSocial)</span></Label>
                <NativeSelect value={form.raceColor} onChange={(e) => setForm((f) => ({ ...f, raceColor: e.target.value }))}>
                  <option value="">Não informado</option>
                  <option value="1">Branca</option>
                  <option value="2">Preta</option>
                  <option value="3">Parda</option>
                  <option value="4">Amarela</option>
                  <option value="5">Indígena</option>
                </NativeSelect>
              </div>
            </TabsContent>
            <TabsContent value="contratuais" className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
              <div>
                <Label>Cargo</Label>
                <NativeSelect value={form.jobId} onChange={(e) => setForm((f) => ({ ...f, jobId: e.target.value }))}>
                  <option value="">Selecionar do catálogo...</option>
                  {(options?.jobs ?? []).map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}
                </NativeSelect>
                {!form.jobId && (
                  <Input className="mt-1" placeholder="...ou digite um cargo novo" value={form.jobName} onChange={(e) => setForm((f) => ({ ...f, jobName: e.target.value }))} />
                )}
              </div>
              <div>
                <Label>Área</Label>
                <NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f) => ({ ...f, orgNodeId: e.target.value }))}>
                  <option value="">Sem área definida</option>
                  {(options?.orgNodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label>CBO do cargo <span className="text-[10px] text-muted-foreground">(eSocial)</span></Label>
                <Input value={form.cbo} inputMode="numeric" maxLength={6} placeholder="Ex.: 252105" onChange={(e) => setForm((f) => ({ ...f, cbo: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 gap-3 rounded-md border p-3 md:grid-cols-5">
                <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:col-span-5">Dados bancários (pagamento da folha)</div>
                <div><Label className="text-xs">Banco</Label><Input value={form.bankCode} inputMode="numeric" maxLength={3} placeholder="341" onChange={(e) => setForm((f) => ({ ...f, bankCode: e.target.value.replace(/\D/g, '') }))} /></div>
                <div><Label className="text-xs">Agência</Label><Input value={form.bankAgency} onChange={(e) => setForm((f) => ({ ...f, bankAgency: e.target.value }))} /></div>
                <div><Label className="text-xs">Conta</Label><Input value={form.bankAccount} onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))} /></div>
                <div><Label className="text-xs">Dígito</Label><Input value={form.bankAccountDigit} maxLength={2} onChange={(e) => setForm((f) => ({ ...f, bankAccountDigit: e.target.value }))} /></div>
                <div><Label className="text-xs">PIX</Label><Input value={form.pixKey} onChange={(e) => setForm((f) => ({ ...f, pixKey: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Tipo de contrato</Label>
                <NativeSelect value={form.contractType} onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))}>
                  <option value="">Não informado</option>
                  {(options?.contractTypes ?? []).map((type) => <option key={type} value={type}>{CONTRACT_LABEL[type] ?? type}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label>Regime de trabalho</Label>
                <NativeSelect value={form.workRegime} onChange={(e) => setForm((f) => ({ ...f, workRegime: e.target.value }))}>
                  <option value="">Não informado</option>
                  {(options?.workRegimes ?? []).map((regime) => <option key={regime} value={regime}>{REGIME_LABEL[regime] ?? regime}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label>Data de admissão</Label>
                <Input type="date" value={form.admissionDate} onChange={(e) => setForm((f) => ({ ...f, admissionDate: e.target.value }))} />
              </div>
              <div>
                <Label>PIS/PASEP</Label>
                <Input value={form.pisPasep} onChange={(e) => setForm((f) => ({ ...f, pisPasep: e.target.value }))} />
              </div>
              <div>
                <Label>CTPS</Label>
                <Input value={form.ctpsNumber} onChange={(e) => setForm((f) => ({ ...f, ctpsNumber: e.target.value }))} />
              </div>
              <div>
                <Label>Usuário do sistema (autoatendimento/ponto)</Label>
                <NativeSelect value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}>
                  <option value="">Sem vínculo</option>
                  {(options?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.name} — {user.email}</option>)}
                </NativeSelect>
              </div>
            </TabsContent>
            <TabsContent value="contato" className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>E-mail pessoal</Label>
                <Input value={form.personalEmail} onChange={(e) => setForm((f) => ({ ...f, personalEmail: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>UF</Label>
                  <Input maxLength={2} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.zipCode} onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Contato de emergência</Label>
                <Input value={form.emergencyContactName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone de emergência</Label>
                <Input value={form.emergencyContactPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 font-semibold text-white hover:bg-blue-700" disabled={save.isPending || !form.name.trim()} onClick={() => save.mutate()}>
              {save.isPending ? 'Salvando...' : 'Salvar colaborador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Prontuário 360° */}
      <Dialog open={Boolean(detailId)} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-5xl overflow-y-auto max-h-[92vh]">
          <DialogHeader>
            <DialogTitle>
              {detail ? (
                <span className="flex flex-wrap items-center gap-2">
                  {detail.name}
                  <Badge variant="outline" className={detail.status === 'ACTIVE' ? 'border-status-green/40 text-status-green' : 'border-status-red/40 text-status-red'}>
                    {detail.status === 'ACTIVE' ? 'Ativo' : 'Desligado'}
                  </Badge>
                  {detail.registrationId && <span className="font-mono text-xs text-muted-foreground">#{detail.registrationId}</span>}
                </span>
              ) : 'Prontuário'}
            </DialogTitle>
          </DialogHeader>
          {!detail && <div className="p-6 text-sm text-muted-foreground">Carregando prontuário...</div>}
          {detail && (
            <Tabs defaultValue="dados">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TabsList className="bg-slate-100 dark:bg-slate-800">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="dependentes">Dependentes ({detail.dependents.length})</TabsTrigger>
                  <TabsTrigger value="dossie">Dossiê ({detail.dossierFiles.length})</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>
                {canUpdate && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openEdit(detail)}>Editar</Button>
                    {detail.status === 'ACTIVE' ? (
                      <Button size="sm" variant="outline" className="h-8 text-xs text-status-red" onClick={() => setReasonDialog({
                        title: `Desligar ${detail.name}`,
                        label: 'Motivo do desligamento',
                        confirmLabel: 'Confirmar desligamento',
                        destructive: true,
                        onConfirm: (reason) => changeStatus.mutate({ id: detail.id, status: 'INACTIVE', reason }),
                      })}>
                        <UserMinus className="mr-1 h-3.5 w-3.5" />Desligar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={changeStatus.isPending} onClick={() => changeStatus.mutate({ id: detail.id, status: 'ACTIVE' })}>
                        Reativar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <TabsContent value="dados" className="pt-3">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <InfoTile label="Cargo" value={detail.job?.name ?? '—'} />
                  <InfoTile label="Área" value={detail.orgNode?.name ?? '—'} />
                  <InfoTile label="Tipo de contrato" value={profileFields.contractType ? (CONTRACT_LABEL[profileFields.contractType] ?? profileFields.contractType) : '—'} />
                  <InfoTile label="Admissão" value={formatDate(profileFields.admissionDate)} />
                  <InfoTile label="CPF" value={profileFields.cpf ? formatCpfDisplay(profileFields.cpf) : '—'} />
                  <InfoTile label="Nascimento" value={formatDate(profileFields.birthDate)} />
                  <InfoTile label="Telefone" value={profileFields.phone ?? '—'} />
                  <InfoTile label="Regime" value={profileFields.workRegime ? (REGIME_LABEL[profileFields.workRegime] ?? profileFields.workRegime) : '—'} />
                  <InfoTile
                    label="Usuário vinculado"
                    value={detail.linkedUser ? `${detail.linkedUser.name}` : 'Sem vínculo'}
                  />
                </div>
                {detail.linkedUser && (
                  <Link href="/servico-pessoal/ponto" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:underline">
                    <Clock className="h-3.5 w-3.5" />Ver controle de ponto
                  </Link>
                )}
                {profileFields.notes && <div className="mt-3 rounded-md border p-3 text-xs text-muted-foreground">{profileFields.notes}</div>}
              </TabsContent>

              <TabsContent value="dependentes" className="space-y-3 pt-3">
                {detail.dependents.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">Nenhum dependente cadastrado.</div>}
                {detail.dependents.map((dependent) => (
                  <div key={dependent.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{dependent.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {RELATIONSHIP_LABEL[dependent.relationship] ?? dependent.relationship}
                        {dependent.birthDate ? ` · nasc. ${formatDate(dependent.birthDate)}` : ''}
                        {dependent.isIrDependent ? ' · dependente IR' : ''}
                      </div>
                    </div>
                    {canUpdate && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-status-red" disabled={removeDependent.isPending} onClick={() => removeDependent.mutate(dependent.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {canUpdate && (
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-xs font-semibold">Adicionar dependente</div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                      <Input placeholder="Nome" className="h-8 text-xs" value={dependentForm.name} onChange={(e) => setDependentForm((f) => ({ ...f, name: e.target.value }))} />
                      <NativeSelect className="h-8 text-xs" value={dependentForm.relationship} onChange={(e) => setDependentForm((f) => ({ ...f, relationship: e.target.value }))}>
                        {(options?.dependentRelationships ?? []).map((rel) => <option key={rel} value={rel}>{RELATIONSHIP_LABEL[rel] ?? rel}</option>)}
                      </NativeSelect>
                      <Input type="date" className="h-8 text-xs" value={dependentForm.birthDate} onChange={(e) => setDependentForm((f) => ({ ...f, birthDate: e.target.value }))} />
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px]">
                          <input type="checkbox" checked={dependentForm.isIrDependent} onChange={(e) => setDependentForm((f) => ({ ...f, isIrDependent: e.target.checked }))} />IR
                        </label>
                        <Button size="sm" className="h-8 flex-1 bg-sky-500 text-xs text-white hover:bg-sky-600" disabled={!dependentForm.name.trim() || addDependent.isPending} onClick={() => addDependent.mutate()}>
                          <Plus className="mr-1 h-3 w-3" />Adicionar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="dossie" className="space-y-3 pt-3">
                {detail.dossierFiles.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">Nenhum documento no dossiê.</div>}
                {detail.dossierFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800 dark:text-slate-200">{file.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {KIND_LABEL[file.kind] ?? file.kind} · {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                        {file.validUntil && (
                          <span className={cn('ml-1 font-semibold', new Date(file.validUntil) < new Date() ? 'text-status-red' : 'text-status-yellow')}>
                            · vence {formatDate(file.validUntil)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar" onClick={() => downloadDossier(detail.id, file.id, file.fileName)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {canUpdate && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-status-red" title="Remover" disabled={removeFile.isPending} onClick={() => removeFile.mutate(file.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {canUpdate && (
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-xs font-semibold">Anexar documento</div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                      <NativeSelect className="h-8 text-xs" value={fileForm.kind} onChange={(e) => setFileForm((f) => ({ ...f, kind: e.target.value }))}>
                        {(options?.dossierKinds ?? []).map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind] ?? kind}</option>)}
                      </NativeSelect>
                      <Input placeholder="Descrição (opcional)" className="h-8 text-xs" value={fileForm.name} onChange={(e) => setFileForm((f) => ({ ...f, name: e.target.value }))} />
                      <Input type="date" title="Validade (opcional)" className="h-8 text-xs" value={fileForm.validUntil} onChange={(e) => setFileForm((f) => ({ ...f, validUntil: e.target.value }))} />
                      <Button size="sm" className="h-8 bg-sky-500 text-xs text-white hover:bg-sky-600" disabled={uploadFile.isPending} onClick={() => fileInputRef.current?.click()}>
                        <FileUp className="mr-1 h-3 w-3" />{uploadFile.isPending ? 'Enviando...' : 'Selecionar arquivo'}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) uploadFile.mutate(file);
                        }}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="historico" className="space-y-3 pt-3">
                {canUpdate && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                    <Input placeholder="Registrar observação na linha do tempo..." className="h-8 flex-1 text-xs" value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} />
                    <Input type="date" className="h-8 w-36 text-xs" value={eventForm.effectiveDate} onChange={(e) => setEventForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
                    <Button size="sm" className="h-8 bg-sky-500 text-xs text-white hover:bg-sky-600" disabled={!eventForm.title.trim() || addEvent.isPending} onClick={() => addEvent.mutate()}>
                      <Plus className="mr-1 h-3 w-3" />Registrar
                    </Button>
                  </div>
                )}
                {detail.employmentEvents.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">Nenhum evento registrado.</div>}
                <div className="space-y-2">
                  {detail.employmentEvents.map((event) => (
                    <div key={event.id} className="flex gap-3 rounded-md border p-3 text-xs">
                      <History className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{event.title}</span>
                          <Badge variant="outline" className="h-4 px-1.5 text-[9px]">{EVENT_LABEL[event.type] ?? event.type}</Badge>
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          <CalendarClock className="mr-1 inline h-3 w-3" />{formatDate(event.effectiveDate)}
                        </div>
                        {event.description && <div className="mt-1 text-muted-foreground">{event.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: importação CSV/XLSX */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Importar colaboradores (CSV/XLSX)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground">
              Cabeçalhos reconhecidos: <span className="font-mono">nome</span> (obrigatório), <span className="font-mono">matricula, cpf, email, cargo, area, admissao, nascimento, telefone, contrato</span>.
              Colaboradores existentes (mesmo CPF, matrícula ou nome) são <strong>atualizados</strong>; novos são criados com evento de admissão.
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
                <FileUp className="mr-1.5 h-3.5 w-3.5" />Selecionar arquivo
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  void handleImportFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              {importRows.length > 0 && <Badge variant="secondary">{importRows.length} linha(s) prontas</Badge>}
            </div>
            {importRows.length > 0 && !importResult && (
              <div className="max-h-48 overflow-auto rounded-md border">
                <table className="w-full text-[10px]">
                  <thead className="bg-muted/40"><tr><th className="px-2 py-1 text-left">Nome</th><th className="px-2 py-1 text-left">CPF</th><th className="px-2 py-1 text-left">Cargo</th><th className="px-2 py-1 text-left">Área</th><th className="px-2 py-1 text-left">Admissão</th></tr></thead>
                  <tbody className="divide-y">
                    {importRows.slice(0, 30).map((row, index) => (
                      <tr key={index}><td className="px-2 py-1">{row.name ?? '—'}</td><td className="px-2 py-1">{row.cpf ?? '—'}</td><td className="px-2 py-1">{row.jobName ?? '—'}</td><td className="px-2 py-1">{row.orgNodeName ?? '—'}</td><td className="px-2 py-1">{row.admissionDate ?? '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {importResult && (
              <div className="space-y-1 rounded-md border p-3">
                <div className="font-semibold text-status-green">{importResult.created} criado(s) · {importResult.updated} atualizado(s)</div>
                {importResult.errors.length > 0 && (
                  <div className="max-h-32 space-y-0.5 overflow-y-auto text-status-red">
                    {importResult.errors.slice(0, 20).map((error, index) => <div key={index}>{error}</div>)}
                    {importResult.errors.length > 20 && <div>... e mais {importResult.errors.length - 20} erro(s)</div>}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Fechar</Button>
            <Button className="bg-sky-500 font-semibold text-white hover:bg-sky-600" disabled={!importRows.length || runImport.isPending || Boolean(importResult)} onClick={() => runImport.mutate()}>
              {runImport.isPending ? 'Importando...' : `Importar ${importRows.length || ''} linha(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: 'emerald' | 'rose' | 'amber' | 'sky' }) {
  const colors = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-rose-600 dark:text-rose-400',
    amber: 'text-amber-600 dark:text-amber-400',
    sky: 'text-sky-600 dark:text-sky-400',
  };
  return (
    <Card className="border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</div>
        </div>
        <div className={cn('rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900', colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function toQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function formatBytes(value: number | null | undefined) {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatCpfDisplay(cpf: string) {
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      if (!base64) reject(new Error('Arquivo vazio'));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha na leitura'));
    reader.readAsDataURL(file);
  });
}

async function downloadDossier(employeeId: string, fileId: string, fileName: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
    const token = getAccessToken();
    const res = await fetch(`${apiUrl}/personnel/employees/${employeeId}/files/${fileId}/download`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Falha no download');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Não foi possível baixar o documento');
  }
}
