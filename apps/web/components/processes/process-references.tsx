'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ProcessIntegrationType } from '@g360/shared';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';

/** Navegação inversa: o registro original aponta para os processos que o utilizam. */
export function ProcessReferences({ type, targetId }: { type: ProcessIntegrationType; targetId: string }) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission(['processes:view']);
  const query = useQuery({ queryKey: ['related-processes', type, targetId], queryFn: () => api<Array<{ id: string; process: { id: string; name: string }; activity: { name: string } | null; href: string }>>(`/processes/governance/related?type=${type}&targetId=${encodeURIComponent(targetId)}`), enabled: allowed && Boolean(targetId), staleTime: 15_000 });
  if (!allowed || query.isLoading || (!query.isError && !query.data?.length)) return null;
  return <section className="my-4 rounded-lg border bg-card p-4"><h3 className="mb-2 text-sm font-semibold">Processos relacionados</h3>{query.isError ? <p role="alert" className="text-xs text-muted-foreground">Não foi possível consultar os processos relacionados.</p> : <div className="flex flex-wrap gap-2">{query.data?.map((link) => <Link key={link.id} href={link.href} className="rounded-md border px-3 py-2 text-sm text-primary hover:bg-muted">{link.process.name}{link.activity ? ` · ${link.activity.name}` : ''}</Link>)}</div>}</section>;
}
