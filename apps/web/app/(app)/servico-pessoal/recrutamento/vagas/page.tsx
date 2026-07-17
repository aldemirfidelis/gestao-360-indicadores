'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Users } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { api } from '@/lib/api';
import { POSTING_STATUS, VISIBILITY, WORK_MODE, formatDateBr, labelOf, metaOf } from '@/lib/recruitment/labels';

interface Posting {
  id: string; slug: string; title: string; status: string; visibility: string; pcd: boolean;
  city: string | null; workMode: string | null; contractType: string | null; closesAt: string | null;
  pipelineTemplate?: { name: string } | null;
  _count?: { applications: number };
}

export default function VacanciesPage() {
  const router = useRouter();
  const listQuery = useQuery<Posting[]>({ queryKey: ['recruit-postings'], queryFn: () => api('/recruitment/postings') });
  const postings = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/recrutamento" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Recrutamento
        </Link>
      </div>
      <PageHeader
        title="Vagas"
        description="Cada vaga nasce de uma requisição aprovada. Clique na vaga para editar a divulgação, configurar a triagem e conduzir os candidatos no pipeline até a admissão."
      />

      {listQuery.isLoading ? (
        <LoadingState label="Carregando vagas..." />
      ) : postings.length === 0 ? (
        <EmptyState
          title="Nenhuma vaga criada"
          description="Vagas são criadas a partir de requisições encaminhadas ao recrutamento. Abra a requisição aprovada e use “Criar vaga”."
          action={<Link href="/servico-pessoal/recrutamento"><Button variant="outline">Ir para requisições</Button></Link>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Vaga</th>
                    <th className="p-3">Visibilidade</th>
                    <th className="p-3">Pipeline</th>
                    <th className="p-3 text-center">Candidatos</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Encerra em</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {postings.map((posting) => {
                    const meta = metaOf(POSTING_STATUS, posting.status);
                    return (
                      <tr
                        key={posting.id}
                        className="cursor-pointer hover:bg-muted/20"
                        onClick={() => router.push(`/servico-pessoal/recrutamento/vagas/${posting.id}`)}
                      >
                        <td className="p-3">
                          <div className="font-medium">{posting.title}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {[posting.city, posting.workMode ? labelOf(WORK_MODE, posting.workMode) : null, posting.contractType].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          {labelOf(VISIBILITY, posting.visibility)}
                          {posting.pcd && <Badge variant="outline" className="ml-1 text-[8px]">PcD</Badge>}
                        </td>
                        <td className="p-3 text-xs">{posting.pipelineTemplate?.name ?? '—'}</td>
                        <td className="p-3 text-center text-xs tabular-nums">{posting._count?.applications ?? 0}</td>
                        <td className="p-3"><StatusBadge label={meta.label} tone={meta.tone} /></td>
                        <td className="p-3 text-xs">{posting.closesAt ? formatDateBr(posting.closesAt) : '—'}</td>
                        <td className="p-3 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Link href={`/servico-pessoal/recrutamento/vagas/${posting.id}`}>
                              <Button variant="ghost" size="sm"><Users className="mr-1 h-3.5 w-3.5" /> Abrir</Button>
                            </Link>
                            {posting.status === 'PUBLISHED' && (
                              <a href={`/carreiras/vagas/${posting.slug}`} target="_blank" rel="noreferrer" title="Página pública">
                                <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
