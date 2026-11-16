'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';

export function ProcessDashboard() {
  const { hasPermission } = useAuth();
  const allowed = hasPermission(['processes:view']);
  const query = useQuery({ queryKey: ['process-governance-dashboard'], queryFn: () => api<{ total: number; withoutOwner: number; documented: number; pendingReview: number; overdueReview: number; activitiesWithoutOwner: number; outsideTarget: number; openDeviations: number; improvementProjects: number; attention: Array<{ id: string; name: string; reasons: string[] }> }>('/processes/governance/dashboard'), enabled: allowed, staleTime: 30_000 });
  if (!allowed || query.isLoading) return null;
  if (query.isError) return <p className="text-xs text-muted-foreground">Resumo de processos indisponível para o acesso atual.</p>;
  if (!query.data) return null;
  const data = query.data;
  return <section className="space-y-3 rounded-lg border bg-card p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Governança de processos</h2><Link className="text-sm text-primary hover:underline" href="/processes">Abrir processos</Link></div><div className="grid gap-3 sm:grid-cols-3">{[['Processos', data.total], ['Com versão publicada', data.documented], ['Sem proprietário', data.withoutOwner], ['Em revisão', data.pendingReview], ['Revisões vencidas', data.overdueReview], ['Atividades sem responsável', data.activitiesWithoutOwner], ['Com indicador fora da meta', data.outsideTarget], ['Com desvio em aberto', data.openDeviations], ['Com projeto de melhoria', data.improvementProjects]].map(([label, value]) => <div key={label} className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}</div>{data.attention.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Consultar processos que precisam de atenção</summary><div className="mt-2 max-h-64 divide-y overflow-y-auto">{data.attention.map((item) => <Link key={item.id} href={`/processes/${item.id}`} className="block py-2 text-sm hover:underline"><span className="text-primary">{item.name}</span><span className="block text-xs text-muted-foreground">{item.reasons.join(' · ')}</span></Link>)}</div></details>}</section>;
}
