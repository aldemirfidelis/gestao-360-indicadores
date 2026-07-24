'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Building2, MapPin, Search, SlidersHorizontal, Sparkles, UserRound } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import {
  CAREERS_API_URL,
  CONTRACT_LABEL,
  type GlobalCareersPayload,
  WORK_MODE_LABEL,
  careersImageUrl,
  labelOf,
  publicVacancyPath,
} from '@/lib/careers';

const EMPTY: GlobalCareersPayload = {
  vacancies: [],
  companies: [],
  facets: { cities: [], workModes: [], contractTypes: [] },
  total: 0,
};

export function GlobalCareersPage() {
  const [data, setData] = useState<GlobalCareersPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: '', city: '', workMode: '', contractType: '', company: '' });

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
    setLoading(true);
    setError(null);
    fetch(`${CAREERS_API_URL}/careers/global?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar as vagas agora.');
        return response.json() as Promise<GlobalCareersPayload>;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  const hasFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);

  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.22),transparent_32%),radial-gradient(circle_at_85%_75%,rgba(16,185,129,0.16),transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid items-end gap-10 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
                <Sparkles className="h-3.5 w-3.5" /> Talentos e oportunidades
              </div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Encontre sua próxima oportunidade.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Todas as vagas públicas das empresas que recrutam pelo Gestão 360, reunidas em um só lugar.
                Candidate-se com um perfil único e acompanhe toda a jornada.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-white/15 bg-white/5 p-5">
                <div className="text-3xl font-black">{data.total}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">Vagas abertas</div>
              </div>
              <div className="border border-white/15 bg-white/5 p-5">
                <div className="text-3xl font-black">{data.companies.length}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">Empresas</div>
              </div>
              <Link href="/candidato" className="col-span-2 flex items-center justify-between bg-sky-500 p-5 font-bold text-slate-950 hover:bg-sky-400">
                <span className="inline-flex items-center gap-2"><UserRound className="h-5 w-5" /> Acessar Área do candidato</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <SlidersHorizontal className="h-4 w-4" /> Filtre as oportunidades
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <label className="relative lg:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                placeholder="Cargo, área ou palavra-chave"
                className="h-10 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500"
              />
            </label>
            <select value={filters.city} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))} className="h-10 border border-slate-300 bg-white px-3 text-sm">
              <option value="">Todas as cidades</option>
              {data.facets.cities.map((city) => <option key={city}>{city}</option>)}
            </select>
            <select value={filters.workMode} onChange={(event) => setFilters((current) => ({ ...current, workMode: event.target.value }))} className="h-10 border border-slate-300 bg-white px-3 text-sm">
              <option value="">Todas as modalidades</option>
              {data.facets.workModes.map((mode) => <option key={mode} value={mode}>{labelOf(WORK_MODE_LABEL, mode)}</option>)}
            </select>
            <select value={filters.contractType} onChange={(event) => setFilters((current) => ({ ...current, contractType: event.target.value }))} className="h-10 border border-slate-300 bg-white px-3 text-sm">
              <option value="">Todos os contratos</option>
              {data.facets.contractTypes.map((contract) => <option key={contract} value={contract}>{labelOf(CONTRACT_LABEL, contract)}</option>)}
            </select>
          </div>
          {hasFilters && (
            <button onClick={() => setFilters({ q: '', city: '', workMode: '', contractType: '', company: '' })} className="mt-3 text-xs font-semibold text-sky-700 hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.72fr_1.8fr] lg:px-8">
          <aside>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-950">Empresas contratando</h2>
            <div className="mt-4 space-y-2">
              {data.companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => setFilters((current) => ({ ...current, company: current.company === company.slug ? '' : company.slug ?? '' }))}
                  className={`flex w-full items-center gap-3 border p-3 text-left transition ${filters.company === company.slug ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                >
                  <CompanyLogo name={company.name} url={company.logoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{company.name}</div>
                    <div className="text-xs text-slate-500">{company.openVacancies} vaga(s)</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
              {!loading && data.companies.length === 0 && <p className="border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhuma empresa encontrada.</p>}
            </div>
          </aside>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-sky-700">Oportunidades</div>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{loading ? 'Buscando vagas...' : `${data.total} vaga(s) encontrada(s)`}</h2>
              </div>
            </div>
            {error && <div className="mt-5 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {data.vacancies.map((vacancy) => (
                <Link
                  key={`${vacancy.company.id}-${vacancy.id}`}
                  href={publicVacancyPath(vacancy.slug, vacancy.company.slug)}
                  className="group flex min-h-56 flex-col border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <CompanyLogo name={vacancy.company.name} url={vacancy.company.logoUrl} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-500">{vacancy.company.name}</div>
                      <h3 className="mt-1 text-lg font-black text-slate-950 group-hover:text-sky-700">{vacancy.title}</h3>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    {(vacancy.city || vacancy.location) && <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1"><MapPin className="h-3 w-3" />{vacancy.city || vacancy.location}</span>}
                    {vacancy.workMode && <span className="bg-slate-100 px-2 py-1">{labelOf(WORK_MODE_LABEL, vacancy.workMode)}</span>}
                    {vacancy.contractType && <span className="bg-slate-100 px-2 py-1">{labelOf(CONTRACT_LABEL, vacancy.contractType)}</span>}
                    {vacancy.pcd && <span className="bg-emerald-50 px-2 py-1 text-emerald-700">Vaga inclusiva PcD</span>}
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{vacancy.description || 'Conheça os detalhes desta oportunidade e candidate-se.'}</p>
                  <div className="mt-auto flex items-center justify-between pt-5 text-sm font-bold text-sky-700">
                    Ver oportunidade <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
            {!loading && !error && data.vacancies.length === 0 && (
              <div className="mt-5 border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-3 font-bold">Nenhuma vaga com estes filtros</h3>
                <p className="mt-1 text-sm text-slate-500">Altere os filtros ou volte em breve para ver novas oportunidades.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function CompanyLogo({ name, url }: { name: string; url: string | null }) {
  const image = careersImageUrl(url);
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={`Logo ${name}`} className="h-11 w-11 shrink-0 border border-slate-200 bg-white object-contain p-1" />
  ) : (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-slate-100 text-slate-500">
      <Building2 className="h-5 w-5" />
    </span>
  );
}
