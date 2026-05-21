'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Building2, Crown, Factory, Users, ShieldAlert, Cog, Wrench, BadgeCheck, Truck, DollarSign, Server, Boxes } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  Building2, Crown, Factory, Users, ShieldAlert, Cog, Wrench, BadgeCheck, Truck, DollarSign, Server, Boxes,
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
  const query = useQuery<TreeNode[]>({
    queryKey: ['orgnodes', 'tree'],
    queryFn: () => api<TreeNode[]>('/orgnodes/tree'),
  });

  return (
    <div>
      <PageHeader
        title="Estrutura Organizacional"
        description="Hierarquia de empresa, filiais, diretorias e areas. Cada no pode receber indicadores e responsaveis."
      />

      <Card>
        <CardContent className="p-4">
          {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {query.data?.map((root) => (
            <Node key={root.id} node={root} level={0} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Node({ node, level }: { node: TreeNode; level: number }) {
  const [open, setOpen] = useState(level < 2);
  const Icon = node.icon && ICONS[node.icon] ? ICONS[node.icon] : Building2;

  return (
    <div className="relative">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/60 transition-colors group',
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-6 w-6 grid place-items-center text-muted-foreground hover:text-foreground"
          aria-label={open ? 'Fechar' : 'Abrir'}
        >
          {node.children.length > 0 ? (
            open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          )}
        </button>
        <span
          className="grid h-9 w-9 place-items-center rounded-md text-white"
          style={{ backgroundColor: node.color ?? 'hsl(var(--muted-foreground))' }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{node.name}</span>
            <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[node.type] ?? node.type}</Badge>
            {node.code && <Badge variant="secondary" className="text-[10px]">{node.code}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">
            {node.responsibleUser?.name ?? 'Sem responsavel'} - {node.indicatorsCount} indicador(es)
          </div>
        </div>
      </div>
      {open && node.children.length > 0 && (
        <div className="border-l border-dashed border-border ml-[1.6rem]">
          {node.children.map((c) => (
            <Node key={c.id} node={c} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
