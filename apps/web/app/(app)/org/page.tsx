'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';

interface TreeNode {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: string;
  color: string | null;
  icon: string | null;
  active: boolean;
  responsibleUser: { id: string; name: string } | null;
  indicatorsCount: number;
  children: TreeNode[];
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
};

const TYPE_LABEL: Record<string, string> = {
  COMPANY: 'Empresa',
  BRANCH: 'Filial',
  DIRECTORATE: 'Diretoria',
  MANAGEMENT: 'Gerencia',
  COORDINATION: 'Coordenacao',
  SECTOR: 'Setor',
  AREA: 'Area',
  PROCESS: 'Processo',
};

export default function OrgPage() {
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const query = useQuery<TreeNode[]>({
    queryKey: ['orgnodes', 'tree'],
    queryFn: () => api<TreeNode[]>('/orgnodes/tree'),
  });

  const stats = useMemo(() => {
    const flat = flatten(query.data ?? []);
    return {
      total: flat.length,
      active: flat.filter((n) => n.active).length,
      indicators: flat.reduce((acc, n) => acc + n.indicatorsCount, 0),
      responsible: flat.filter((n) => n.responsibleUser).length,
    };
  }, [query.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Visualizacao"
        tone="view"
        title="Arvore de setores, areas e indicadores"
        description="Hierarquia de gestao com responsaveis, quantidade de indicadores e status da estrutura."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Visualizacao', href: '/visualization' }, { label: 'Arvore de gestao' }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Nos da estrutura" value={formatNumber(stats.total)} description="Empresa, setores e processos" icon={<Network className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(stats.active)} description="Liberados para uso" icon={<BadgeCheck className="h-4 w-4" />} tone="green" />
        <MetricCard title="Indicadores vinculados" value={formatNumber(stats.indicators)} description="Distribuidos na arvore" icon={<Target className="h-4 w-4" />} tone="purple" />
        <MetricCard title="Com responsavel" value={formatNumber(stats.responsible)} description="Governanca atribuida" icon={<UserRound className="h-4 w-4" />} tone="yellow" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,360px]">
        <SectionCard title="Estrutura organizacional" description="Expanda os niveis para navegar pela hierarquia." contentClassName="p-3">
          {query.isLoading && <LoadingState />}
          {!query.isLoading && (query.data?.length ?? 0) === 0 && (
            <EmptyState title="Nenhuma estrutura cadastrada" description="Cadastre setores e areas para vincular indicadores." />
          )}
          <div className="space-y-1">
            {query.data?.map((root) => (
              <OrgNode key={root.id} node={root} level={0} selectedId={selected?.id ?? null} onSelect={setSelected} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Detalhes do item" description="Resumo do no selecionado.">
          {!selected && (
            <EmptyState title="Selecione um item" description="Os detalhes de responsavel e indicadores aparecem neste painel." className="border-0 bg-transparent" />
          )}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{TYPE_LABEL[selected.type] ?? selected.type}</Badge>
                      {selected.code && <Badge variant="secondary">{selected.code}</Badge>}
                    </div>
                  </div>
                  <StatusBadge value={selected.active ? 'ACTIVE' : 'CANCELLED'} label={selected.active ? 'Ativo' : 'Inativo'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Indicadores</div>
                  <div className="mt-1 text-2xl font-semibold">{selected.indicatorsCount}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Subniveis</div>
                  <div className="mt-1 text-2xl font-semibold">{selected.children.length}</div>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Responsavel</div>
                <div className="mt-1 text-sm font-medium">{selected.responsibleUser?.name ?? 'Sem responsavel'}</div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function OrgNode({
  node,
  level,
  selectedId,
  onSelect,
}: {
  node: TreeNode;
  level: number;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
}) {
  const [open, setOpen] = useState(level < 2);
  const Icon = node.icon && ICONS[node.icon] ? ICONS[node.icon] : Building2;
  const selected = selectedId === node.id;

  return (
    <div>
      <div
        className={cn(
          'grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/45',
          selected && 'bg-primary/10 ring-1 ring-primary/20',
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
        <button onClick={() => onSelect(node)} className="flex min-w-0 items-center gap-3 text-left">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-sm"
            style={{ backgroundColor: node.color ?? 'hsl(var(--primary))' }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{node.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {TYPE_LABEL[node.type] ?? node.type} - {node.responsibleUser?.name ?? 'Sem responsavel'}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden sm:inline-flex">{node.indicatorsCount} ind.</Badge>
          <StatusBadge value={node.active ? 'ACTIVE' : 'CANCELLED'} label={node.active ? 'Ativo' : 'Inativo'} className="hidden md:inline-flex" />
        </div>
      </div>
      {open && node.children.length > 0 && (
        <div className="ml-5 border-l border-dashed">
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} level={level + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}
