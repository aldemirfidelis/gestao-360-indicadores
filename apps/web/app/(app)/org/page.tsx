'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cog,
  Crown,
  DollarSign,
  Edit3,
  Factory,
  Network,
  Plus,
  Save,
  Server,
  ShieldAlert,
  Target,
  Trash2,
  Truck,
  UserCog,
  UserRound,
  Users,
  Wrench,
  X,
  Building,
  Landmark,
  UserCheck,
  GraduationCap,
  Briefcase,
  LineChart,
  PieChart,
  TrendingUp,
  Megaphone,
  Compass,
  Activity,
  Cpu,
  HardDrive,
  Database,
  ShieldCheck,
  HeartPulse,
  ShoppingBag,
  Scale,
  Search,
  Award,
  HelpCircle,
  Phone,
  Globe,
  Flame,
  Droplet,
  Lightbulb,
  FileText,
  Calendar,
  Lock,
  Eye,
  Key,
  Workflow,
  Layers,
  Presentation,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';
import { useVision360 } from '@/components/ui/vision360-context';

interface TreeNode {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  active: boolean;
  responsibleUserId: string | null;
  responsibleUser: { id: string; name: string } | null;
  indicatorsCount: number;
  children: TreeNode[];
}

interface FlatNode {
  id: string;
  name: string;
  type: string;
}

interface UserRow {
  id: string;
  name: string;
}

interface ActivityItem {
  id: string;
  description: string;
  orderIndex: number;
  isActive: boolean;
}

interface OrgActivity {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isActive: boolean;
  items: ActivityItem[];
}

interface OrgNodeDetail {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  active: boolean;
  responsibleUserId: string | null;
  responsibleUser: { id: string; name: string; email?: string | null; jobTitle?: string | null } | null;
  company: { id: string; name: string; tradeName?: string | null };
  branch: { id: string; name: string; code?: string | null; city?: string | null; state?: string | null } | null;
  parent: { id: string; name: string; type: string } | null;
  breadcrumb: Array<{ id: string | null; name: string; type: string }>;
  counts: { children: number; users: number; employees: number; indicators: number; openActions: number };
  canEdit: boolean;
  activities: OrgActivity[];
}

const ICONS: Record<string, any> = {
  Building2,
  Crown,
  Factory,
  Users,
  ShieldAlert,
  Cog,
  Wrench,
  BadgeCheck,
  Truck,
  DollarSign,
  Server,
  Boxes,
  Target,
  Building,
  Landmark,
  UserCheck,
  GraduationCap,
  Briefcase,
  LineChart,
  PieChart,
  TrendingUp,
  Megaphone,
  Compass,
  Activity,
  Cpu,
  HardDrive,
  Database,
  ShieldCheck,
  HeartPulse,
  ShoppingBag,
  Scale,
  Search,
  Award,
  HelpCircle,
  Phone,
  Globe,
  Flame,
  Droplet,
  Lightbulb,
  FileText,
  Calendar,
  Lock,
  Eye,
  Key,
  Workflow,
  Layers,
  Presentation,
  CheckCircle,
};

const TYPE_LABEL: Record<string, string> = {
  COMPANY: 'Empresa',
  SECTOR: 'Área',
  AREA: 'Setor',
  BRANCH: 'Filial',
  UNIT: 'Pilar',
  DIRECTORATE: 'Diretriz',
  PROCESS: 'Processo',
};

const TYPE_OPTIONS = [
  ['COMPANY', 'Empresa'],
  ['SECTOR', 'Área'],
  ['AREA', 'Setor'],
  ['BRANCH', 'Filial'],
  ['UNIT', 'Pilar'],
  ['DIRECTORATE', 'Diretriz'],
  ['PROCESS', 'Processo'],
] as const;

const emptyNode = {
  id: '',
  parentId: '',
  name: '',
  code: '',
  type: 'AREA',
  responsibleUserId: '',
  description: '',
  color: '#164e63',
  icon: 'Target',
  active: true,
};

type NodeForm = typeof emptyNode;

export default function OrgPage() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NodeForm>(emptyNode);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ id: '', title: '', description: '', orderIndex: 1, isActive: true });
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ id: '', activityId: '', description: '', orderIndex: 1, isActive: true });
  const qc = useQueryClient();
  const { user, hasPermission } = useAuth();
  const createMode = searchParams.get('create');
  const canManageOrg = user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN' || hasPermission('org:manage');

  const tree = useQuery<TreeNode[]>({
    queryKey: ['orgnodes', 'tree'],
    queryFn: () => api<TreeNode[]>('/orgnodes/tree'),
  });
  const detail = useQuery<OrgNodeDetail>({
    queryKey: ['orgnodes', 'detail', selectedNodeId],
    queryFn: () => api<OrgNodeDetail>(`/orgnodes/${selectedNodeId}`),
    enabled: Boolean(selectedNodeId),
  });
  const flat = useQuery<FlatNode[]>({
    queryKey: ['orgnodes'],
    queryFn: () => api<FlatNode[]>('/orgnodes'),
  });
  const users = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/users'),
  });

  const stats = useMemo(() => {
    const items = flatten(tree.data ?? []);
    return {
      total: items.length,
      active: items.filter((n) => n.active).length,
      indicators: items.reduce((acc, n) => acc + n.indicatorsCount, 0),
      responsible: items.filter((n) => n.responsibleUser).length,
    };
  }, [tree.data]);

  const saveNode = useMutation({
    mutationFn: () => {
      const payload = {
        companyId: user?.companyId,
        parentId: form.parentId || null,
        name: form.name,
        code: form.code || null,
        type: form.type,
        responsibleUserId: form.responsibleUserId || null,
        description: form.description || null,
        color: form.color || null,
        icon: form.icon || null,
        active: form.active,
      };
      return form.id
        ? api(`/orgnodes/${form.id}`, { method: 'PATCH', json: payload })
        : api('/orgnodes', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Estrutura salva');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['orgnodes'] });
      if (selectedNodeId) qc.invalidateQueries({ queryKey: ['orgnodes', 'detail', selectedNodeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar estrutura'),
  });

  const removeNode = useMutation({
    mutationFn: (id: string) => api(`/orgnodes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Item inativado');
      qc.invalidateQueries({ queryKey: ['orgnodes'] });
      setSelectedNodeId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao inativar item'),
  });

  const invalidateDetail = () => {
    if (selectedNodeId) qc.invalidateQueries({ queryKey: ['orgnodes', 'detail', selectedNodeId] });
  };

  const saveActivity = useMutation({
    mutationFn: () => {
      if (!selectedNodeId) throw new Error('Selecione um item da arvore.');
      const payload = {
        title: activityForm.title,
        description: activityForm.description || null,
        orderIndex: Number(activityForm.orderIndex) || 1,
        isActive: activityForm.isActive,
      };
      return activityForm.id
        ? api(`/orgnodes/${selectedNodeId}/activities/${activityForm.id}`, { method: 'PATCH', json: payload })
        : api(`/orgnodes/${selectedNodeId}/activities`, { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Responsabilidade salva');
      setActivityDialogOpen(false);
      invalidateDetail();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar responsabilidade'),
  });

  const updateActivity = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<OrgActivity> }) => {
      if (!selectedNodeId) throw new Error('Selecione um item da arvore.');
      return api(`/orgnodes/${selectedNodeId}/activities/${id}`, { method: 'PATCH', json: body });
    },
    onSuccess: () => invalidateDetail(),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar responsabilidade'),
  });

  const removeActivity = useMutation({
    mutationFn: (id: string) => {
      if (!selectedNodeId) throw new Error('Selecione um item da arvore.');
      return api(`/orgnodes/${selectedNodeId}/activities/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Responsabilidade inativada');
      invalidateDetail();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao inativar responsabilidade'),
  });

  const saveItem = useMutation({
    mutationFn: () => {
      if (!selectedNodeId) throw new Error('Selecione um item da arvore.');
      const payload = {
        description: itemForm.description,
        orderIndex: Number(itemForm.orderIndex) || 1,
        isActive: itemForm.isActive,
      };
      return itemForm.id
        ? api(`/orgnodes/${selectedNodeId}/activities/${itemForm.activityId}/items/${itemForm.id}`, { method: 'PATCH', json: payload })
        : api(`/orgnodes/${selectedNodeId}/activities/${itemForm.activityId}/items`, { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Topico salvo');
      setItemDialogOpen(false);
      invalidateDetail();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar topico'),
  });

  const updateItem = useMutation({
    mutationFn: ({ activityId, itemId, body }: { activityId: string; itemId: string; body: Partial<ActivityItem> }) => {
      if (!selectedNodeId) throw new Error('Selecione um item da arvore.');
      return api(`/orgnodes/${selectedNodeId}/activities/${activityId}/items/${itemId}`, { method: 'PATCH', json: body });
    },
    onSuccess: () => invalidateDetail(),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar topico'),
  });

  const removeItem = useMutation({
    mutationFn: ({ activityId, itemId }: { activityId: string; itemId: string }) => {
      if (!selectedNodeId) throw new Error('Selecione um item da arvore.');
      return api(`/orgnodes/${selectedNodeId}/activities/${activityId}/items/${itemId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Topico inativado');
      invalidateDetail();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao inativar topico'),
  });

  const openNode = (node?: TreeNode | OrgNodeDetail, parentId?: string) => {
    setForm(
      node
        ? {
            id: node.id,
            parentId: node.parentId ?? '',
            name: node.name,
            code: node.code ?? '',
            type: node.type,
            responsibleUserId: node.responsibleUserId ?? '',
            description: node.description ?? '',
            color: node.color ?? '#164e63',
            icon: node.icon ?? 'Target',
            active: node.active,
          }
        : { ...emptyNode, parentId: parentId ?? '' },
    );
    setOpen(true);
  };

  const openActivityDialog = (activity?: OrgActivity) => {
    setActivityForm(
      activity
        ? {
            id: activity.id,
            title: activity.title,
            description: activity.description ?? '',
            orderIndex: activity.orderIndex,
            isActive: activity.isActive,
          }
        : {
            id: '',
            title: '',
            description: '',
            orderIndex: (detail.data?.activities.length ?? 0) + 1,
            isActive: true,
          },
    );
    setActivityDialogOpen(true);
  };

  const openItemDialog = (activityId: string, item?: ActivityItem) => {
    const activity = detail.data?.activities.find((entry) => entry.id === activityId);
    setItemForm(
      item
        ? {
            id: item.id,
            activityId,
            description: item.description,
            orderIndex: item.orderIndex,
            isActive: item.isActive,
          }
        : {
            id: '',
            activityId,
            description: '',
            orderIndex: (activity?.items.length ?? 0) + 1,
            isActive: true,
          },
    );
    setItemDialogOpen(true);
  };

  useEffect(() => {
    if (!createMode) return;
    const type = 
      createMode === 'guideline' 
        ? 'DIRECTORATE' 
        : createMode === 'pilar'
          ? 'UNIT'
          : createMode === 'micro' 
            ? 'AREA' 
            : 'SECTOR';
    const name =
      createMode === 'guideline'
        ? 'Nova diretriz'
        : createMode === 'pilar'
          ? 'Novo pilar'
          : createMode === 'micro'
            ? 'Novo setor'
            : 'Nova área';
    setForm({
      ...emptyNode,
      name: '',
      type,
      parentId: '',
      description: name,
    });
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createMode]);

  return (
    <div>
      <PageHeader
        eyebrow="Visualização"
        tone="view"
        title="Estrutura de gestão, Empresa, Áreas e setores"
        description="Modelo livre para organizar Áreas e os indicadores vinculados a cada pilar."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Visualização', href: '/visualization' }, { label: 'Arvore de gestão' }]}
        actions={
          canManageOrg ? (
            <Button onClick={() => openNode()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo item
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Nos da estrutura" value={formatNumber(stats.total)} description="Valores, áreas e pilares" icon={<Network className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(stats.active)} description="Liberados para uso" icon={<BadgeCheck className="h-4 w-4" />} tone="green" />
        <MetricCard title="Indicadores vinculados" value={formatNumber(stats.indicators)} description="Distribuidos por pilar" icon={<Target className="h-4 w-4" />} tone="purple" />
        <MetricCard title="Com responsável" value={formatNumber(stats.responsible)} description="Governanca atribuida" icon={<UserRound className="h-4 w-4" />} tone="yellow" />
      </div>

      <SectionCard title="Estrutura de gestão" description="Dados da estrutura, responsaveis e responsabilidades por setor." contentClassName="p-3">
        {tree.isLoading && <LoadingState />}
        {!tree.isLoading && (tree.data?.length ?? 0) === 0 && (
          <EmptyState title="Nenhuma estrutura cadastrada" description="Crie Valores, Diretrizes, Áreas e Pilares para vincular indicadores." />
        )}
        <div className="space-y-1">
          {tree.data?.map((root) => (
            <OrgNode
              key={root.id}
              node={root}
              level={0}
              canManage={canManageOrg}
              selectedId={selectedNodeId}
              onView={(n) => setSelectedNodeId(n.id)}
              onEdit={(n) => openNode(n)}
              onAddChild={(parentId) => openNode(undefined, parentId)}
              onRemove={(id) => {
                if (window.confirm('Inativar este item da estrutura?')) removeNode.mutate(id);
              }}
            />
          ))}
        </div>
      </SectionCard>

      {selectedNodeId && (
        <OrgDetailPanel
          detail={detail.data}
          loading={detail.isLoading}
          canManage={canManageOrg && Boolean(detail.data?.canEdit ?? true)}
          onClose={() => setSelectedNodeId(null)}
          onAddActivity={() => openActivityDialog()}
          onEditActivity={openActivityDialog}
          onToggleActivity={(activity) => updateActivity.mutate({ id: activity.id, body: { isActive: !activity.isActive } })}
          onMoveActivity={(activity, direction) => updateActivity.mutate({ id: activity.id, body: { orderIndex: Math.max(1, activity.orderIndex + direction) } })}
          onRemoveActivity={(activity) => {
            if (window.confirm('Inativar esta responsabilidade?')) removeActivity.mutate(activity.id);
          }}
          onAddItem={(activityId) => openItemDialog(activityId)}
          onEditItem={openItemDialog}
          onToggleItem={(activityId, item) => updateItem.mutate({ activityId, itemId: item.id, body: { isActive: !item.isActive } })}
          onMoveItem={(activityId, item, direction) => updateItem.mutate({ activityId, itemId: item.id, body: { orderIndex: Math.max(1, item.orderIndex + direction) } })}
          onRemoveItem={(activityId, item) => {
            if (window.confirm('Inativar este topico?')) removeItem.mutate({ activityId, itemId: item.id });
          }}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar item da estrutura' : 'Novo item da estrutura'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPE_OPTIONS.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Código</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>Nível pai</Label>
              <NativeSelect value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">Raiz da estrutura</option>
                {flat.data?.filter((node) => node.id !== form.id).map((node) => (
                  <option key={node.id} value={node.id}>{node.name} ({TYPE_LABEL[node.type] ?? node.type})</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Responsável</Label>
              <NativeSelect value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })}>
                <option value="">Sem responsável</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={form.active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </NativeSelect>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Ícone</Label>
                <span className="text-xs text-muted-foreground font-medium">Selecione o ícone representativo</span>
              </div>
              <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 max-h-[160px] overflow-y-auto p-1 bg-background rounded border border-border/60">
                  {Object.entries(ICONS).map(([name, IconComponent]) => {
                    const isSelected = form.icon === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setForm({ ...form, icon: name })}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-200",
                          isSelected 
                            ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 scale-105" 
                            : "border-border/50 text-muted-foreground hover:bg-accent hover:text-foreground hover:scale-105"
                        )}
                        title={name}
                      >
                        <IconComponent className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveNode.mutate()} disabled={!form.name || saveNode.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar estrutura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activityForm.id ? 'Editar responsabilidade' : 'Nova responsabilidade'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Titulo</Label>
              <Input value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" min={1} value={activityForm.orderIndex} onChange={(e) => setActivityForm({ ...activityForm, orderIndex: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={activityForm.isActive ? 'true' : 'false'} onChange={(e) => setActivityForm({ ...activityForm, isActive: e.target.value === 'true' })}>
                <option value="true">Ativa</option>
                <option value="false">Inativa</option>
              </NativeSelect>
            </div>
            <div className="md:col-span-2">
              <Label>Descricao</Label>
              <Textarea rows={3} value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActivityDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveActivity.mutate()} disabled={!activityForm.title.trim() || saveActivity.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{itemForm.id ? 'Editar topico' : 'Novo topico'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr,140px]">
            <div>
              <Label>Descricao</Label>
              <Textarea rows={3} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            </div>
            <div className="grid gap-4">
              <div>
                <Label>Ordem</Label>
                <Input type="number" min={1} value={itemForm.orderIndex} onChange={(e) => setItemForm({ ...itemForm, orderIndex: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Status</Label>
                <NativeSelect value={itemForm.isActive ? 'true' : 'false'} onChange={(e) => setItemForm({ ...itemForm, isActive: e.target.value === 'true' })}>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </NativeSelect>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveItem.mutate()} disabled={!itemForm.description.trim() || saveItem.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrgNode({
  node,
  level,
  canManage,
  selectedId,
  onView,
  onEdit,
  onAddChild,
  onRemove,
}: {
  node: TreeNode;
  level: number;
  canManage: boolean;
  selectedId: string | null;
  onView: (node: TreeNode) => void;
  onEdit: (node: TreeNode) => void;
  onAddChild: (parentId: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(level < 2);
  const { open: openVision360 } = useVision360();
  const Icon = node.icon && ICONS[node.icon] ? ICONS[node.icon] : Building2;

  return (
    <div>
      <div
        className={cn(
          'grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/45',
          selectedId === node.id && 'bg-primary/5 ring-1 ring-primary/20',
        )}
        style={{ paddingLeft: `${level * 1.25 + 0.5}rem` }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label={open ? 'Recolher' : 'Expandir'}
        >
          {node.children.length > 0 ? (
            open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          )}
        </button>
        <button onClick={() => onView(node)} className="flex min-w-0 items-center gap-3 text-left" title="Ver detalhes">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-sm"
            style={{ backgroundColor: node.color ?? 'hsl(var(--primary))' }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{node.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {TYPE_LABEL[node.type] ?? node.type} - {node.responsibleUser?.name ?? 'Sem responsável'}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden sm:inline-flex">{node.indicatorsCount} ind.</Badge>
          <button
            onClick={() => openVision360('ORG_NODE', node.id)}
            className="rounded-md border bg-card px-2 py-1 text-xs text-primary hover:bg-primary/5 inline-flex items-center gap-1 shadow-sm transition"
            title="Visão 360°"
          >
            <Network className="h-3 w-3 text-primary" />
            <span className="hidden sm:inline">360°</span>
          </button>
          <StatusBadge value={node.active ? 'ACTIVE' : 'CANCELLED'} label={node.active ? 'Ativo' : 'Inativo'} className="hidden md:inline-flex" />
          {canManage && (
            <>
              <button
                onClick={() => onEdit(node)}
                className="hidden rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
                title="Editar"
              >
                Editar
              </button>
              <button
                onClick={() => onAddChild(node.id)}
                className="hidden rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
                title="Adicionar filho"
              >
                + filho
              </button>
              <button
                onClick={() => onRemove(node.id)}
                className="hidden rounded-md border bg-card px-2 py-1 text-xs text-destructive hover:bg-destructive/10 sm:inline-flex"
                title="Inativar"
              >
                Inativar
              </button>
            </>
          )}
        </div>
      </div>
      {open && node.children.length > 0 && (
        <div className="ml-5 border-l border-dashed">
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} level={level + 1} canManage={canManage} selectedId={selectedId} onView={onView} onEdit={onEdit} onAddChild={onAddChild} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgDetailPanel({
  detail,
  loading,
  canManage,
  onClose,
  onAddActivity,
  onEditActivity,
  onToggleActivity,
  onMoveActivity,
  onRemoveActivity,
  onAddItem,
  onEditItem,
  onToggleItem,
  onMoveItem,
  onRemoveItem,
}: {
  detail?: OrgNodeDetail;
  loading: boolean;
  canManage: boolean;
  onClose: () => void;
  onAddActivity: () => void;
  onEditActivity: (activity: OrgActivity) => void;
  onToggleActivity: (activity: OrgActivity) => void;
  onMoveActivity: (activity: OrgActivity, direction: number) => void;
  onRemoveActivity: (activity: OrgActivity) => void;
  onAddItem: (activityId: string) => void;
  onEditItem: (activityId: string, item: ActivityItem) => void;
  onToggleItem: (activityId: string, item: ActivityItem) => void;
  onMoveItem: (activityId: string, item: ActivityItem, direction: number) => void;
  onRemoveItem: (activityId: string, item: ActivityItem) => void;
}) {
  const { open: openVision360 } = useVision360();
  const [isEditing, setIsEditing] = useState(false);
  const Icon = detail?.icon && ICONS[detail.icon] ? ICONS[detail.icon] : Building2;

  return (
    <div className="fixed inset-0 z-40">
      <button className="absolute inset-0 bg-black/25" aria-label="Fechar detalhes" onClick={onClose} />
      <aside className="absolute left-0 top-0 flex h-full w-full max-w-xl flex-col border-r border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: detail?.color ?? 'hsl(var(--primary))' }}
            >
              {loading ? <ClipboardList className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-status-green">
                Detalhes da estrutura
              </div>
              <h2 className="truncate text-xl font-semibold">{loading ? 'Carregando...' : detail?.name}</h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Fechar" aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <LoadingState />}
          {!loading && detail && (
            <div className="space-y-4">
              {detail.description && (
                <div className="rounded-lg border border-border/60 p-4 bg-muted/10">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Descrição do setor
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                    {detail.description}
                  </p>
                </div>
              )}

              <div className="rounded-md border border-border/60">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 bg-muted/10">
                  <div>
                    <div className="text-sm font-semibold">Principais responsabilidades</div>
                    <div className="text-xs text-muted-foreground">Blocos e topicos vinculados somente a este item organizacional.</div>
                  </div>
                  {canManage && isEditing && (
                    <Button size="sm" variant="outline" onClick={onAddActivity}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Bloco
                    </Button>
                  )}
                </div>

                {detail.activities.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="Sem responsabilidades cadastradas" description="Este item ainda nao possui atividades institucionais registradas." />
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {detail.activities.map((activity, index) => (
                      <div key={activity.id} className={cn('p-3', !activity.isActive && 'opacity-60')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">
                                {index + 1}
                              </span>
                              <div className="min-w-0 text-sm font-semibold whitespace-pre-wrap break-words flex-1">{activity.title}</div>
                              {!activity.isActive && <Badge variant="secondary">Inativo</Badge>}
                            </div>
                            {activity.description && <p className="mt-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">{activity.description}</p>}
                          </div>
                          {canManage && isEditing && (
                            <div className="flex shrink-0 items-center gap-1">
                              <IconAction title="Subir" onClick={() => onMoveActivity(activity, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconAction>
                              <IconAction title="Descer" onClick={() => onMoveActivity(activity, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconAction>
                              <IconAction title="Editar" onClick={() => onEditActivity(activity)}><Edit3 className="h-3.5 w-3.5" /></IconAction>
                              <IconAction title={activity.isActive ? 'Inativar' : 'Ativar'} onClick={() => onToggleActivity(activity)}>
                                <BadgeCheck className="h-3.5 w-3.5" />
                              </IconAction>
                              <IconAction title="Excluir" danger onClick={() => onRemoveActivity(activity)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 space-y-2">
                          {activity.items.map((item) => (
                            <div key={item.id} className={cn('flex items-start justify-between gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm', !item.isActive && 'opacity-60')}>
                              <div className="min-w-0 leading-relaxed whitespace-pre-wrap break-words flex-1">
                                <span className="mr-2 text-xs font-semibold text-muted-foreground">{item.orderIndex}.</span>
                                {item.description}
                              </div>
                              {canManage && isEditing && (
                                <div className="flex shrink-0 items-center gap-1">
                                  <IconAction title="Subir" onClick={() => onMoveItem(activity.id, item, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconAction>
                                  <IconAction title="Descer" onClick={() => onMoveItem(activity.id, item, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconAction>
                                  <IconAction title="Editar" onClick={() => onEditItem(activity.id, item)}><Edit3 className="h-3.5 w-3.5" /></IconAction>
                                  <IconAction title={item.isActive ? 'Inativar' : 'Ativar'} onClick={() => onToggleItem(activity.id, item)}>
                                    <BadgeCheck className="h-3.5 w-3.5" />
                                  </IconAction>
                                  <IconAction title="Excluir" danger onClick={() => onRemoveItem(activity.id, item)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
                                </div>
                              )}
                            </div>
                          ))}
                          {canManage && isEditing && (
                            <Button size="sm" variant="ghost" onClick={() => onAddItem(activity.id)}>
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Tópico
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!loading && detail && (
          <div className="border-t border-border/60 bg-muted/20 p-4 flex gap-2 justify-end shrink-0">
            {canManage && (
              <Button
                size="sm"
                variant={isEditing ? 'default' : 'outline'}
                onClick={() => setIsEditing(!isEditing)}
                className="shadow-sm"
              >
                <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                {isEditing ? 'Visualizar' : 'Editar responsabilidades'}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => openVision360('ORG_NODE', detail.id)}
              className="shadow-sm"
            >
              <Network className="mr-1.5 h-3.5 w-3.5" />
              Visão 360°
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}

function IconAction({ title, onClick, children, danger = false }: { title: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground',
        danger && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
      )}
    >
      {children}
    </button>
  );
}

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}
