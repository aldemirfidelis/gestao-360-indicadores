'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BadgeCheck,
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  Cog,
  Crown,
  DollarSign,
  Factory,
  Network,
  Plus,
  Save,
  Server,
  ShieldAlert,
  Target,
  Truck,
  UserRound,
  Users,
  Wrench,
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
  const qc = useQueryClient();
  const { user } = useAuth();
  const createMode = searchParams.get('create');

  const tree = useQuery<TreeNode[]>({
    queryKey: ['orgnodes', 'tree'],
    queryFn: () => api<TreeNode[]>('/orgnodes/tree'),
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
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar estrutura'),
  });

  const removeNode = useMutation({
    mutationFn: (id: string) => api(`/orgnodes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Item inativado');
      qc.invalidateQueries({ queryKey: ['orgnodes'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao inativar item'),
  });

  const openNode = (node?: TreeNode, parentId?: string) => {
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
          <Button onClick={() => openNode()}>
            <Plus className="mr-2 h-4 w-4" />
            Novo item
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Nos da estrutura" value={formatNumber(stats.total)} description="Valores, áreas e pilares" icon={<Network className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(stats.active)} description="Liberados para uso" icon={<BadgeCheck className="h-4 w-4" />} tone="green" />
        <MetricCard title="Indicadores vinculados" value={formatNumber(stats.indicators)} description="Distribuidos por pilar" icon={<Target className="h-4 w-4" />} tone="purple" />
        <MetricCard title="Com responsável" value={formatNumber(stats.responsible)} description="Governanca atribuida" icon={<UserRound className="h-4 w-4" />} tone="yellow" />
      </div>

      <SectionCard title="Estrutura de gestão" description="Expanda, edite ou crie filhos diretamente em cada nível da hierarquia." contentClassName="p-3">
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
              onEdit={(n) => openNode(n)}
              onAddChild={(parentId) => openNode(undefined, parentId)}
              onRemove={(id) => {
                if (window.confirm('Inativar este item da estrutura?')) removeNode.mutate(id);
              }}
            />
          ))}
        </div>
      </SectionCard>

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
    </div>
  );
}

function OrgNode({
  node,
  level,
  onEdit,
  onAddChild,
  onRemove,
}: {
  node: TreeNode;
  level: number;
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
        className="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/45"
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
        <button onClick={() => onEdit(node)} className="flex min-w-0 items-center gap-3 text-left" title="Editar item">
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
        </div>
      </div>
      {open && node.children.length > 0 && (
        <div className="ml-5 border-l border-dashed">
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} level={level + 1} onEdit={onEdit} onAddChild={onAddChild} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}
