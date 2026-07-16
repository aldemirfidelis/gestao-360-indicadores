'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Vacancy {
  slug: string; title: string; area: string | null; city: string | null; location: string | null;
  workMode: string | null; contractType: string | null; pcd: boolean; publishedAt: string | null; closed: boolean;
}
interface CareersData { company: { name: string; slug: string | null; logoUrl: string | null }; vacancies: Vacancy[] }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

/** Slug da empresa: ?empresa= tem prioridade; senão o subdomínio do host. */
function resolveSlug(param: string | null): string | null {
  if (param) return param;
  if (typeof window === 'undefined') return null;
  const parts = window.location.hostname.split('.');
  if (parts.length >= 3 && !['www', 'app'].includes(parts[0])) return parts[0];
  return null;
}

const MODE_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', HIBRIDO: 'Híbrido', REMOTO: 'Remoto' };

export default function CareersListPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-8 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-300">Carregando vagas...</main>}>
      <CareersListContent />
    </Suspense>
  );
}

function CareersListContent() {
  const params = useSearchParams();
  const slug = useMemo(() => resolveSlug(params.get('empresa')), [params]);
  const [data, setData] = useState<CareersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [mode, setMode] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    if (slug) qs.set('empresa', slug);
    if (q) qs.set('q', q);
    if (city) qs.set('city', city);
    if (mode) qs.set('workMode', mode);
    fetch(`${API}/careers/vacancies?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Empresa não encontrada.'))))
      .then((d) => { if (active) { setData(d); setLoading(false); } })
      .catch((e) => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [slug, q, city, mode]);

  const suffix = slug ? `?empresa=${slug}` : '';

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          {data?.company.logoUrl && <img src={data.company.logoUrl} alt="" className="h-10 w-auto" />}
          <div>
            <h1 className="text-lg font-bold">{data?.company.name ?? 'Carreiras'}</h1>
            <p className="text-xs text-slate-500">Trabalhe conosco</p>
          </div>
          <Link href={`/candidato${suffix}`} className="ml-auto text-xs font-medium text-sky-600 hover:underline dark:text-sky-400">Area do candidato</Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="text-2xl font-bold tracking-tight">Vagas abertas</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cargo ou área…" className="rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Todas as modalidades</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="HIBRIDO">Híbrido</option>
            <option value="REMOTO">Remoto</option>
          </select>
        </div>

        <div className="mt-6 space-y-3">
          {loading && <div className="py-12 text-center text-slate-400">Carregando vagas…</div>}
          {error && <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">{error} {!slug && 'Informe a empresa em ?empresa=slug ou acesse pelo subdomínio.'}</div>}
          {!loading && !error && data && data.vacancies.length === 0 && <div className="py-12 text-center text-slate-400">Nenhuma vaga aberta no momento.</div>}
          {data?.vacancies.map((v) => (
            <Link key={v.slug} href={`/carreiras/vagas/${v.slug}${suffix}`}
              className="block rounded-lg border bg-white p-4 transition hover:border-sky-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{v.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{[v.area, v.city || v.location, v.workMode ? MODE_LABEL[v.workMode] ?? v.workMode : null, v.contractType].filter(Boolean).join(' · ')}</p>
                </div>
                {v.pcd && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">PcD</span>}
              </div>
              <div className="mt-2 text-xs font-medium text-sky-600 dark:text-sky-400">Ver vaga →</div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400">
        Processo seletivo conduzido por {data?.company.name ?? 'nossa empresa'}. Seus dados são tratados conforme a LGPD.
      </footer>
    </main>
  );
}
