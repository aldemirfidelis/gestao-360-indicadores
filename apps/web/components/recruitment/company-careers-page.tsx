'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Globe2, Linkedin, MapPin, Search, UserRound } from 'lucide-react';
import {
  CAREERS_API_URL,
  CONTRACT_LABEL,
  type CompanyCareersPayload,
  WORK_MODE_LABEL,
  candidatePortalPath,
  careersImageUrl,
  labelOf,
  publicVacancyPath,
} from '@/lib/careers';

export function CompanyCareersPage({ empresa }: { empresa: string }) {
  const [data, setData] = useState<CompanyCareersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: '', city: '', workMode: '', contractType: '' });

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ empresa });
    for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
    setLoading(true);
    setError(null);
    fetch(`${CAREERS_API_URL}/careers/vacancies?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(payload?.message ?? 'Página de carreiras não encontrada.');
        }
        return response.json() as Promise<CompanyCareersPayload>;
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
  }, [empresa, filters]);

  if (!data && loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Carregando página de carreiras...</main>;
  }
  if (!data || error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md border border-amber-200 bg-white p-8 text-center">
          <BriefcaseBusiness className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-black">Página indisponível</h1>
          <p className="mt-2 text-sm text-slate-600">{error ?? 'Esta empresa ainda não publicou sua página de carreiras.'}</p>
          <Link href="/carreiras" className="mt-5 inline-flex items-center gap-2 bg-slate-950 px-4 py-2 text-sm font-bold text-white">
            Ver todas as vagas
          </Link>
        </div>
      </main>
    );
  }

  const { company, careerPage: page, vacancies, facets } = data;
  const banner = careersImageUrl(page.bannerUrl);
  const logo = careersImageUrl(page.logoUrl);
  const centered = page.heroAlignment === 'CENTER';
  const minimal = page.template === 'MINIMAL';
  const corporate = page.template === 'CORPORATE';

  return (
    <main className="min-h-screen text-slate-950" style={{ backgroundColor: page.backgroundColor }}>
      <header className="border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`Logo ${company.name}`} className="h-10 max-w-44 object-contain" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center bg-slate-100"><Building2 className="h-5 w-5" /></span>
          )}
          <span className="hidden text-sm font-bold sm:inline">{company.name}</span>
          <nav className="ml-auto flex items-center gap-2 text-xs font-bold">
            <Link href="/carreiras" className="hidden items-center gap-1 border border-slate-300 px-3 py-2 hover:bg-slate-50 sm:inline-flex">
              <ArrowLeft className="h-3.5 w-3.5" /> Todas as vagas
            </Link>
            <Link href={candidatePortalPath(company.slug)} className="inline-flex items-center gap-1 px-3 py-2 text-white" style={{ backgroundColor: page.secondaryColor }}>
              <UserRound className="h-3.5 w-3.5" /> Área do candidato
            </Link>
          </nav>
        </div>
      </header>

      <section
        className={`relative overflow-hidden ${minimal ? 'border-b border-black/10' : 'text-white'}`}
        style={{ backgroundColor: minimal ? page.backgroundColor : page.primaryColor }}
      >
        {banner && !minimal && (
          <>
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${banner}")` }} />
            <div className="absolute inset-0 bg-slate-950/65" />
          </>
        )}
        <div className={`relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24 ${centered ? 'text-center' : ''}`}>
          <div className={`${centered ? 'mx-auto' : ''} max-w-3xl`}>
            {logo && banner && !minimal && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className={`mb-7 h-16 max-w-56 bg-white/95 object-contain p-2 ${centered ? 'mx-auto' : ''}`} />
            )}
            <p className={`text-xs font-black uppercase tracking-[0.2em] ${minimal ? 'text-slate-500' : 'text-white/70'}`}>Carreiras em {company.name}</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">{page.headline}</h1>
            <p className={`mt-5 max-w-2xl text-base leading-7 sm:text-lg ${centered ? 'mx-auto' : ''} ${minimal ? 'text-slate-600' : 'text-white/80'}`}>{page.subheadline}</p>
            <a href="#vagas" className="mt-8 inline-flex items-center gap-2 px-5 py-3 text-sm font-black text-white" style={{ backgroundColor: page.accentColor }}>
              Ver vagas abertas <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section id="vagas" className="scroll-mt-20 border-b border-black/10 bg-white/80">
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <label className="relative lg:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Busque por cargo ou área" className="h-10 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none" style={{ borderColor: filters.q ? page.secondaryColor : undefined }} />
            </label>
            <select value={filters.city} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))} className="h-10 border border-slate-300 bg-white px-3 text-sm">
              <option value="">Todas as cidades</option>
              {facets.cities.map((city) => <option key={city}>{city}</option>)}
            </select>
            <select value={filters.workMode} onChange={(event) => setFilters((current) => ({ ...current, workMode: event.target.value }))} className="h-10 border border-slate-300 bg-white px-3 text-sm">
              <option value="">Todas as modalidades</option>
              {facets.workModes.map((mode) => <option key={mode} value={mode}>{labelOf(WORK_MODE_LABEL, mode)}</option>)}
            </select>
            <select value={filters.contractType} onChange={(event) => setFilters((current) => ({ ...current, contractType: event.target.value }))} className="h-10 border border-slate-300 bg-white px-3 text-sm">
              <option value="">Todos os contratos</option>
              {facets.contractTypes.map((contract) => <option key={contract} value={contract}>{labelOf(CONTRACT_LABEL, contract)}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.55fr_0.75fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: page.secondaryColor }}>Oportunidades abertas</p>
          <h2 className="mt-2 text-3xl font-black">{loading ? 'Atualizando...' : `${vacancies.length} vaga(s)`}</h2>
          <div className="mt-5 space-y-3">
            {vacancies.map((vacancy) => (
              <Link
                key={vacancy.id}
                href={publicVacancyPath(vacancy.slug, company.slug)}
                className={`group block border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${corporate ? 'border-l-4' : 'border-slate-200'}`}
                style={corporate ? { borderLeftColor: page.secondaryColor } : undefined}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{vacancy.area || 'Oportunidade'}</div>
                    <h3 className="mt-1 text-xl font-black group-hover:underline" style={{ color: page.primaryColor }}>{vacancy.title}</h3>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 transition group-hover:translate-x-1" style={{ color: page.secondaryColor }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  {(vacancy.city || vacancy.location) && <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1"><MapPin className="h-3 w-3" />{vacancy.city || vacancy.location}</span>}
                  {vacancy.workMode && <span className="bg-slate-100 px-2 py-1">{labelOf(WORK_MODE_LABEL, vacancy.workMode)}</span>}
                  {vacancy.contractType && <span className="bg-slate-100 px-2 py-1">{labelOf(CONTRACT_LABEL, vacancy.contractType)}</span>}
                  {vacancy.pcd && <span className="px-2 py-1 text-white" style={{ backgroundColor: page.accentColor }}>Inclusiva PcD</span>}
                </div>
                <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{vacancy.description || 'Veja os detalhes da oportunidade e candidate-se.'}</p>
              </Link>
            ))}
            {!loading && vacancies.length === 0 && <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Nenhuma vaga encontrada com estes filtros.</div>}
          </div>
        </div>

        <aside className="space-y-4">
          {page.showAbout && page.aboutText && <ContentBlock title={page.aboutTitle} text={page.aboutText} color={page.primaryColor} />}
          {page.showCulture && page.cultureText && <ContentBlock title={page.cultureTitle} text={page.cultureText} color={page.primaryColor} />}
          {page.showBenefits && page.benefitsText && <ContentBlock title={page.benefitsTitle} text={page.benefitsText} color={page.primaryColor} />}
          {(page.websiteUrl || page.linkedinUrl || page.contactEmail) && (
            <div className="border border-black/10 bg-white p-5">
              <h3 className="font-black">Conheça mais</h3>
              <div className="mt-4 space-y-2 text-sm">
                {page.websiteUrl && <a href={page.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold hover:underline"><Globe2 className="h-4 w-4" /> Site da empresa</a>}
                {page.linkedinUrl && <a href={page.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold hover:underline"><Linkedin className="h-4 w-4" /> LinkedIn</a>}
                {page.contactEmail && <a href={`mailto:${page.contactEmail}`} className="block font-semibold hover:underline">{page.contactEmail}</a>}
              </div>
            </div>
          )}
        </aside>
      </section>

      <footer className="border-t border-black/10 px-4 py-7 text-center text-xs text-slate-500">
        Processo seletivo conduzido por {company.name} com tecnologia Gestão 360. Seus dados são tratados conforme a LGPD.
      </footer>
    </main>
  );
}

function ContentBlock({ title, text, color }: { title: string; text: string; color: string }) {
  return (
    <div className="border border-black/10 bg-white p-5">
      <h3 className="text-lg font-black" style={{ color }}>{title}</h3>
      <div className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{text}</div>
    </div>
  );
}
