'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Briefcase, CheckCircle2, MapPin, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { APPLICATION_STATUS, WORK_MODE, labelOf, metaOf } from '@/lib/recruitment/labels';
import { api } from '@/lib/api';

interface InternalPosting {
  id: string; title: string; publicDescription: string | null; publicRequirements: string | null; benefitsText: string | null;
  location: string | null; city: string | null; workMode: string | null; contractType: string | null; areaName: string | null;
  showSalary: boolean; salaryText: string | null;
}
interface MyInternalApplication { id: string; status: string; appliedAt: string; stage: string | null; posting: { title: string; slug: string } }

/** Vagas internas — auto-candidatura do colaborador (self-service, sem permissão dedicada). */
export function VagasInternasPanel() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [consent, setConsent] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  const listQuery = useQuery<InternalPosting[]>({ queryKey: ['internal-postings'], queryFn: () => api('/recruitment/internal-postings') });
  const myAppsQuery = useQuery<MyInternalApplication[]>({ queryKey: ['internal-postings', 'my-applications'], queryFn: () => api('/recruitment/internal-postings/my-applications') });
  const detailQuery = useQuery<InternalPosting>({
    queryKey: ['internal-posting', openId],
    queryFn: () => api(`/recruitment/internal-postings/${openId}`),
    enabled: Boolean(openId),
  });

  const apply = useMutation({
    mutationFn: () => api(`/recruitment/internal-postings/${openId}/apply`, { method: 'POST', json: { consent, coverLetter: coverLetter || undefined } }),
    onSuccess: () => {
      toast.success('Candidatura enviada! O RH vai analisar seu perfil.');
      setApplied(openId);
      setCoverLetter(''); setConsent(false);
      void qc.invalidateQueries({ queryKey: ['internal-postings', 'my-applications'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível enviar a candidatura.'),
  });

  const postings = listQuery.data ?? [];
  const myApps = myAppsQuery.data ?? [];
  const appliedPostingTitles = new Set(myApps.map((a) => a.posting.title));
  const detail = detailQuery.data;
  const alreadyApplied = detail ? appliedPostingTitles.has(detail.title) : false;

  return (
    <div className="space-y-4">
      {myApps.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 text-sm font-semibold">Minhas candidaturas internas</div>
            <div className="space-y-1.5">
              {myApps.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                  <span className="font-medium">{a.posting.title}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {a.stage && <span>{a.stage}</span>}
                    <StatusBadge {...metaOf(APPLICATION_STATUS, a.status)} />
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {listQuery.isLoading ? (
        <LoadingState label="Carregando vagas..." />
      ) : postings.length === 0 ? (
        <EmptyState icon={<Briefcase className="h-5 w-5" />} title="Nenhuma vaga interna aberta no momento" description="Volte mais tarde — novas oportunidades aparecem aqui assim que publicadas." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {postings.map((p) => (
            <Card key={p.id} className="cursor-pointer transition hover:border-status-blue/50" onClick={() => setOpenId(p.id)}>
              <CardContent className="p-4">
                <div className="font-semibold">{p.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {p.areaName && <span>{p.areaName}</span>}
                  {(p.city || p.location) && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{p.city || p.location}</span>}
                  {p.workMode && <Badge variant="outline" className="text-[10px]">{labelOf(WORK_MODE, p.workMode)}</Badge>}
                </div>
                {appliedPostingTitles.has(p.title) && (
                  <Badge variant="outline" className="mt-2 gap-1 text-[10px] text-status-green"><CheckCircle2 className="h-3 w-3" /> Você já se candidatou</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={Boolean(openId)} onOpenChange={(open) => { if (!open) { setOpenId(null); setApplied(null); } }}>
        <SheetContent className="sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.title}</SheetTitle>
                <div className="text-xs text-muted-foreground">
                  {[detail.areaName, detail.city || detail.location, detail.workMode ? labelOf(WORK_MODE, detail.workMode) : null, detail.contractType].filter(Boolean).join(' · ')}
                </div>
              </SheetHeader>
              <SheetBody className="space-y-4">
                {detail.publicDescription && <div><div className="text-xs font-bold uppercase text-muted-foreground">Descrição</div><p className="mt-1 whitespace-pre-wrap text-sm">{detail.publicDescription}</p></div>}
                {detail.publicRequirements && <div><div className="text-xs font-bold uppercase text-muted-foreground">Requisitos</div><p className="mt-1 whitespace-pre-wrap text-sm">{detail.publicRequirements}</p></div>}
                {detail.benefitsText && <div><div className="text-xs font-bold uppercase text-muted-foreground">Benefícios</div><p className="mt-1 whitespace-pre-wrap text-sm">{detail.benefitsText}</p></div>}
                {detail.showSalary && detail.salaryText && <p className="text-sm font-medium">Faixa: {detail.salaryText}</p>}

                <div className="rounded-md border p-3">
                  {applied === openId ? (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> Candidatura enviada.
                    </div>
                  ) : alreadyApplied ? (
                    <p className="text-xs text-muted-foreground">Você já se candidatou a esta vaga.</p>
                  ) : (
                    <div className="space-y-3">
                      <Textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={3} placeholder="Mensagem opcional para o RH" />
                      <label className="flex items-start gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                        Autorizo o uso dos meus dados de colaborador para fins deste processo seletivo interno.
                      </label>
                      <Button size="sm" className="w-full" disabled={!consent || apply.isPending} onClick={() => apply.mutate()}>
                        <Send className="mr-2 h-3.5 w-3.5" /> {apply.isPending ? 'Enviando...' : 'Candidatar-se'}
                      </Button>
                    </div>
                  )}
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
