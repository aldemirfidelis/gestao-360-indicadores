'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'DONE' | 'CANCELLED';
  startsAt: string | null;
  endsAt: string | null;
  responsible: string | null;
  budget: number | null;
  progressOverall: number;
  _count: { tasks: number; milestones: number };
}

const STATUS_PILL: Record<string, string> = {
  PLANNED: 'pill-gray',
  IN_PROGRESS: 'pill-blue',
  ON_HOLD: 'pill-yellow',
  DONE: 'pill-green',
  CANCELLED: 'pill-gray',
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  IN_PROGRESS: 'Em andamento',
  ON_HOLD: 'Pausado',
  DONE: 'Concluido',
  CANCELLED: 'Cancelado',
};

export default function ProjectsPage() {
  const query = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api<Project[]>('/projects'),
  });

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Iniciativas estrategicas com cronograma, marcos e tarefas."
        actions={<Button disabled><Plus className="h-4 w-4 mr-2" />Novo projeto</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {query.data?.map((p) => {
          const late = p.endsAt && new Date(p.endsAt) < new Date() && p.status !== 'DONE';
          return (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <span className={cn('pill', STATUS_PILL[p.status])}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                  <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground mt-3">
                    <div>
                      <div className="text-[10px] uppercase">Inicio</div>
                      <div className="text-foreground">{formatDate(p.startsAt)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase">Fim previsto</div>
                      <div className={cn('text-foreground', late && 'text-status-red')}>
                        {formatDate(p.endsAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase">Marcos</div>
                      <div className="text-foreground">{p._count.milestones}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{p._count.tasks} tarefa(s)</span>
                      <span className="font-medium">{p.progressOverall}%</span>
                    </div>
                    <Progress value={p.progressOverall} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {!query.isLoading && query.data?.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum projeto cadastrado.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
