'use client';

import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { platformAdminApi } from '@/lib/platform-admin-api';
import {
  DEMO_AREA_LABEL,
  DEVICE_LABEL,
  demoPageLabel,
  eventText,
  fmtDateTime,
  fmtDuration,
  fmtNumber,
  placeLabel,
  sitePageLabel,
  SOURCE_LABEL,
  stateName,
  type SiteVisitDetail,
  type SiteVisitRow,
  VISIT_RESULT,
  visitResult,
} from '@/lib/site-visits';
import { cn } from '@/lib/utils';

export type VisitStatusFilter = '' | 'contacted' | 'demo_navigated' | 'demo_entered' | 'demo_clicked' | 'no_demo' | 'bounced';

export interface VisitFilters {
  status: VisitStatusFilter;
  source: string;
  region: string;
  device: string;
}

export const NO_VISIT_FILTERS: VisitFilters = { status: '', source: '', region: '', device: '' };

const STATUS_TABS: { key: VisitStatusFilter; label: string }[] = [
  { key: '', label: 'Todas' },
  { key: 'contacted', label: 'Entraram em contato' },
  { key: 'demo_navigated', label: 'Navegaram na demo' },
  { key: 'demo_entered', label: 'Entraram na demo e pararam' },
  { key: 'demo_clicked', label: 'Clicaram e a demo não abriu' },
  { key: 'no_demo', label: 'Não abriram a demo' },
  { key: 'bounced', label: 'Saíram sem interagir' },
];

const PAGE_SIZE = 25;

function ResultPill({ v }: { v: SiteVisitRow }) {
  const r = VISIT_RESULT[visitResult(v)];
  return <span className={cn('pill whitespace-nowrap', r.pill)}>{r.label}</span>;
}

function sourceText(v: Pick<SiteVisitRow, 'source' | 'utmCampaign' | 'referrerHost'>) {
  return {
    main: SOURCE_LABEL[v.source] ?? v.source,
    sub: v.utmCampaign ? `campanha ${v.utmCampaign}` : v.source === 'referral' ? v.referrerHost : null,
  };
}

function demoText(v: Pick<SiteVisitRow, 'demoStartedAt' | 'demoPathCount' | 'demoMs'>) {
  if (!v.demoStartedAt) return null;
  return `${v.demoPathCount} ${v.demoPathCount === 1 ? 'página' : 'páginas'} · ${fmtDuration(v.demoMs)}`;
}

/** Lista de visitas do período, com os filtros que os quadros da página também acionam. */
export const SiteVisitsList = forwardRef<HTMLDivElement, { period: { from: string; to: string }; filters: VisitFilters; onFilters: (f: VisitFilters) => void }>(
  function SiteVisitsList({ period, filters, onFilters }, ref) {
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [bots, setBots] = useState(false);
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<string | null>(null);

    useEffect(() => {
      const timer = setTimeout(() => setDebounced(search.trim()), 300);
      return () => clearTimeout(timer);
    }, [search]);

    const filterKey = JSON.stringify([period, filters, debounced, bots]);
    useEffect(() => setPage(1), [filterKey]);

    const list = useQuery({
      queryKey: ['platform-admin', 'site-analytics', 'visits', filterKey, page],
      queryFn: () => {
        const params = new URLSearchParams({ from: period.from, to: period.to, page: String(page), pageSize: String(PAGE_SIZE) });
        for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
        if (debounced) params.set('search', debounced);
        if (bots) params.set('bots', 'true');
        return platformAdminApi<{ rows: SiteVisitRow[]; total: number; page: number; pageSize: number }>(`/site-analytics/visits?${params}`);
      },
      placeholderData: (previous) => previous,
    });
    const set = (patch: Partial<VisitFilters>) => onFilters({ ...filters, ...patch });
    const total = list.data?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div ref={ref} className="scroll-mt-4">
        <section className="border bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Visitas</h2>
            <p className="text-xs text-muted-foreground">Cada acesso, do mais recente para o mais antigo. Clique numa linha para ver o caminho da pessoa no site e na demonstração.</p>
          </div>
          <div className="flex flex-wrap gap-1 border-b px-3 py-2" role="group" aria-label="Resultado da visita">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key || 'all'}
                type="button"
                onClick={() => set({ status: tab.key })}
                aria-pressed={filters.status === tab.key}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium transition-colors',
                  filters.status === tab.key ? 'bg-[#101820] text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-b px-4 py-3 md:flex-row md:flex-wrap md:items-center">
            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8" placeholder="IP, cidade, campanha ou site de origem" aria-label="Buscar visitas" />
            </div>
            <NativeSelect className="h-9 w-full md:w-52" value={filters.source} onChange={(e) => set({ source: e.target.value })} aria-label="Origem">
              <option value="">Todas as origens</option>
              {Object.entries(SOURCE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </NativeSelect>
            <NativeSelect className="h-9 w-full md:w-44" value={filters.device} onChange={(e) => set({ device: e.target.value })} aria-label="Aparelho">
              <option value="">Todos os aparelhos</option>
              {Object.entries(DEVICE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} className="h-4 w-4" />
              Mostrar robôs
            </label>
            {filters.region && (
              <span className="inline-flex items-center gap-1 border px-2 py-1 text-xs">
                Estado: {stateName(filters.region)}
                <button type="button" onClick={() => set({ region: '' })} aria-label="Tirar o filtro de estado" className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>

          {list.isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando visitas...</div>
          ) : list.isError ? (
            <div className="m-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Não foi possível carregar as visitas: {list.error instanceof Error ? list.error.message : 'erro desconhecido'}.
            </div>
          ) : !list.data?.rows.length ? (
            <div className="m-4 grid min-h-24 place-items-center border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Nenhuma visita no período com esses filtros.
              </div>
            </div>
          ) : (
            <div className={cn('overflow-x-auto transition-opacity', list.isFetching && 'opacity-60')}>
              <table className="table-modern tabular-nums">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Local</th>
                    <th>IP</th>
                    <th>Aparelho</th>
                    <th>Origem</th>
                    <th className="text-right">Tempo</th>
                    <th>Na demonstração</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.rows.map((v) => {
                    const src = sourceText(v);
                    const demo = demoText(v);
                    return (
                      <tr key={v.id} className="cursor-pointer" onClick={() => setOpen(v.id)}>
                        <td className="whitespace-nowrap">
                          <button
                            type="button"
                            className="font-mono text-xs hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpen(v.id);
                            }}
                            aria-label={`Detalhes da visita de ${fmtDateTime(v.startedAt)}`}
                          >
                            {fmtDateTime(v.startedAt)}
                          </button>
                          {(v.visitorVisits ?? 1) > 1 && <span className="block text-xs text-muted-foreground">voltou · {v.visitorVisits} visitas</span>}
                        </td>
                        <td className="whitespace-nowrap">{placeLabel(v)}</td>
                        <td className="font-mono text-xs text-muted-foreground">{v.ip ?? '-'}</td>
                        <td className="whitespace-nowrap">
                          {DEVICE_LABEL[v.device] ?? v.device}
                          {v.isBot && <span className="pill pill-yellow ml-1">robô</span>}
                          <span className="block text-xs text-muted-foreground">{[v.browser, v.os].filter(Boolean).join(' · ') || '-'}</span>
                        </td>
                        <td className="whitespace-nowrap">
                          {src.main}
                          {src.sub && <span className="block max-w-[14rem] truncate text-xs text-muted-foreground" title={src.sub}>{src.sub}</span>}
                        </td>
                        <td className="whitespace-nowrap text-right">{fmtDuration(v.activeMs)}</td>
                        <td className="whitespace-nowrap text-muted-foreground">{demo ?? (v.firstDemoClickAt ? 'clicou, não abriu' : '-')}</td>
                        <td className="whitespace-nowrap">
                          <ResultPill v={v} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {list.data && total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
              <span>
                {fmtNumber((page - 1) * PAGE_SIZE + 1)}–{fmtNumber(Math.min(page * PAGE_SIZE, total))} de {fmtNumber(total)} visitas
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Página anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  {page} / {pages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Próxima página">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
        <VisitDialog id={open} onClose={() => setOpen(null)} onOpen={setOpen} />
      </div>
    );
  },
);

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children || '-'}</dd>
    </div>
  );
}

function VisitDialog({ id, onClose, onOpen }: { id: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const detail = useQuery({
    queryKey: ['platform-admin', 'site-analytics', 'visit', id],
    queryFn: () => platformAdminApi<SiteVisitDetail>(`/site-analytics/visits/${id}`),
    enabled: Boolean(id),
  });
  const v = detail.data;
  const start = v ? new Date(v.startedAt).getTime() : 0;
  const areas = v ? [...new Set(v.demoPaths.map((p) => p.split('/')[1]))] : [];

  return (
    <Dialog open={Boolean(id)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-4xl rounded-none sm:rounded-none">
        <DialogHeader>
          <DialogTitle>Visita ao site</DialogTitle>
          {v && <p className="text-sm text-muted-foreground">{fmtDateTime(v.startedAt)} · {placeLabel(v)}</p>}
        </DialogHeader>
        {detail.isLoading || !v ? (
          detail.isError ? (
            <p className="text-sm text-red-700">Não foi possível abrir a visita: {detail.error instanceof Error ? detail.error.message : 'erro desconhecido'}.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <ResultPill v={v} />
              {v.isBot && <span className="pill pill-yellow">robô ou navegador automatizado</span>}
            </div>

            {v.contacts.length > 0 && (
              <section aria-labelledby="visit-contacts" className="border border-emerald-200 bg-emerald-50/60 p-3">
                <h3 id="visit-contacts" className="mb-2 text-sm font-semibold">Formulário enviado nesta visita</h3>
                <ul className="space-y-2 text-sm">
                  {v.contacts.map((c) => (
                    <li key={c.id}>
                      <span className="font-medium">{c.name}</span> · {c.company}
                      {c.role ? ` · ${c.role}` : ''} ·{' '}
                      <a href={`mailto:${c.email}`} className="text-cyan-700 hover:underline">{c.email}</a>
                      {c.phone ? ` · ${c.phone}` : ''}
                      <span className="block text-xs text-muted-foreground">{c.requestType} · {fmtDateTime(c.createdAt)} · a mensagem está em HelpDesk e Caixa de Entrada</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
              <Info label="Tempo no site">{fmtDuration(v.activeMs)}</Info>
              <Info label="Tempo na demonstração">{v.demoStartedAt ? fmtDuration(v.demoMs) : 'não entrou'}</Info>
              <Info label="Rolagem da página inicial">{v.sections.length ? `${v.maxScrollPct}%` : 'não viu a página inicial'}</Info>
              <Info label="Última atividade">{fmtDateTime(v.lastSeenAt)}</Info>
              <Info label="Local (aproximado)">{placeLabel(v)}</Info>
              <Info label="IP">{v.ip ? <span className="font-mono text-xs">{v.ip}</span> : null}</Info>
              <Info label="Aparelho">{[DEVICE_LABEL[v.device] ?? v.device, v.browser, v.os].filter(Boolean).join(' · ')}</Info>
              <Info label="Visitas deste navegador">{fmtNumber(v.history.length)}</Info>
              <Info label="Origem">{sourceText(v).main}</Info>
              <Info label="Veio do site">{v.referrer}</Info>
              <Info label="Página de entrada"><span className="font-mono text-xs">{v.entryPath}</span></Info>
              <Info label="Campanha (UTM)">{[v.utmSource, v.utmMedium, v.utmCampaign, v.utmTerm, v.utmContent].filter(Boolean).join(' · ')}</Info>
              <Info label="Tela · idioma · fuso">{[v.screen, v.language, v.timezone].filter(Boolean).join(' · ')}</Info>
              <Info label="Páginas do site">{v.pages.map(sitePageLabel).join(', ')}</Info>
              <Info label="Áreas da demonstração">{areas.map((a) => DEMO_AREA_LABEL[a] ?? a).join(', ')}</Info>
              <Info label="Páginas na demonstração">{v.demoPaths.length ? `${v.demoPathCount} (${fmtNumber(v.demoPageViews)} aberturas)` : ''}</Info>
            </dl>

            <section aria-labelledby="visit-timeline">
              <h3 id="visit-timeline" className="mb-2 text-sm font-semibold">Caminho da visita</h3>
              {!v.events.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma página ou clique registrado.</p>
              ) : (
                <ol className="max-h-80 space-y-1.5 overflow-y-auto border p-3 text-sm">
                  {v.events.map((e) => (
                    <li key={e.id} className="flex gap-3">
                      <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">+{fmtDuration(new Date(e.createdAt).getTime() - start)}</span>
                      <span className={cn(e.type === 'demo_error' ? 'text-red-700' : ['demo_start', 'whatsapp_click', 'form_submit'].includes(e.type) ? 'font-medium' : 'text-muted-foreground')}>
                        {eventText(e)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {v.eventCount > v.events.length && <p className="mt-1 text-xs text-muted-foreground">Mostrando os primeiros {fmtNumber(v.events.length)} de {fmtNumber(v.eventCount)} registros.</p>}
            </section>

            {v.history.length > 1 && (
              <section aria-labelledby="visit-history">
                <h3 id="visit-history" className="mb-2 text-sm font-semibold">Outras visitas deste navegador</h3>
                <div className="overflow-x-auto border">
                  <table className="table-modern tabular-nums">
                    <thead>
                      <tr>
                        <th>Quando</th>
                        <th>Origem</th>
                        <th className="text-right">Tempo</th>
                        <th>Na demonstração</th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.history.map((h) => (
                        <tr key={h.id} className={h.id === v.id ? 'bg-cyan-50/60' : 'cursor-pointer'} onClick={() => h.id !== v.id && onOpen(h.id)}>
                          <td className="whitespace-nowrap font-mono text-xs">
                            {fmtDateTime(h.startedAt)}
                            {h.id === v.id && <span className="ml-1 font-sans text-muted-foreground">(esta)</span>}
                          </td>
                          <td>{sourceText(h).main}</td>
                          <td className="text-right">{fmtDuration(h.activeMs)}</td>
                          <td className="text-muted-foreground">{demoText(h) ?? '-'}</td>
                          <td><ResultPill v={h} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {v.demoPaths.length > 0 && (
              <p className="text-xs text-muted-foreground">Páginas da demonstração: {v.demoPaths.map(demoPageLabel).join(' · ')}</p>
            )}
            {v.userAgent && <p className="break-all font-mono text-[11px] text-muted-foreground">{v.userAgent}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
