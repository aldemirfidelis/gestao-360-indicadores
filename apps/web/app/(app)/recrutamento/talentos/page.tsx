'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { CandidateSheet } from '@/components/recruitment/candidate-sheet';
import { APPLICATION_STATUS, formatDateBr, metaOf } from '@/lib/recruitment/labels';
import { StatusBadge } from '@/components/platform/status-badge';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface TalentCandidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  headline: string | null;
  city: string | null;
  tags: string[];
  lastApplication: { id: string; status: string; appliedAt: string; vaga: string } | null;
}

export default function TalentPoolPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canView = hasPermission(['recruit:view', 'recruit:manage']);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(null);

  const tagsQuery = useQuery<string[]>({ queryKey: ['recruit-candidate-tags'], queryFn: () => api('/recruitment/candidates/tags'), enabled: canView });
  const listQuery = useQuery<TalentCandidate[]>({
    queryKey: ['recruit-talent-pool', q, tag, onlyAvailable],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (tag) params.set('tag', tag);
      if (onlyAvailable) params.set('onlyAvailable', 'true');
      return api(`/recruitment/candidates?${params.toString()}`);
    },
    enabled: canView,
  });

  const candidates = listQuery.data ?? [];

  if (!canView) {
    return (
      <div className="space-y-4">
        <PageHeader title="Banco de talentos" description="Candidatos que já se candidataram a vagas desta empresa." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Você não tem permissão para ver o banco de talentos.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Banco de talentos"
        description="Todos os candidatos que já se candidataram a alguma vaga desta empresa — busque por nome, cidade ou tag para reaproveitar em novas oportunidades."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, e-mail, cidade ou headline..." className="pl-8" />
          </div>
          <NativeSelect value={tag} onChange={(e) => setTag(e.target.value)} className="h-9 w-48">
            <option value="">Todas as tags</option>
            {(tagsQuery.data ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            Somente disponíveis (sem processo ativo)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <LoadingState label="Carregando candidatos..." />
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Nenhum candidato encontrado"
              description="Candidatos aparecem aqui assim que se candidatam a alguma vaga desta empresa. Ajuste os filtros ou aguarde novas candidaturas."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Candidato</th>
                    <th className="p-3">Tags</th>
                    <th className="p-3">Última candidatura</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {candidates.map((c) => (
                    <tr key={c.id} className="cursor-pointer hover:bg-muted/20" onClick={() => c.lastApplication && setOpenApplicationId(c.lastApplication.id)}>
                      <td className="p-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">{[c.email, c.city, c.headline].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                        </div>
                      </td>
                      <td className="p-3 text-xs">
                        {c.lastApplication ? (
                          <>
                            <div>{c.lastApplication.vaga}</div>
                            <div className="text-[11px] text-muted-foreground">{formatDateBr(c.lastApplication.appliedAt)}</div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="p-3">
                        {c.lastApplication ? <StatusBadge {...metaOf(APPLICATION_STATUS, c.lastApplication.status)} /> : <Badge variant="outline" className="text-[10px]">Sem candidatura ativa</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CandidateSheet
        applicationId={openApplicationId}
        stages={[]}
        scorecard={[]}
        onClose={() => setOpenApplicationId(null)}
        onChanged={() => { void qc.invalidateQueries({ queryKey: ['recruit-talent-pool'] }); void qc.invalidateQueries({ queryKey: ['recruit-candidate-tags'] }); }}
      />
    </div>
  );
}
