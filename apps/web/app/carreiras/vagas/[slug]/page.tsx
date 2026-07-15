'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

interface Vacancy {
  slug: string; title: string; description: string | null; requirements: string | null; benefits: string | null;
  processSteps: string | null; area: string | null; city: string | null; location: string | null;
  workMode: string | null; contractType: string | null; pcd: boolean; salary: string | null; closesAt: string | null; closed: boolean;
}
interface Data { company: { name: string; slug: string | null; logoUrl: string | null }; vacancy: Vacancy }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
const MODE_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', HIBRIDO: 'Híbrido', REMOTO: 'Remoto' };

function resolveSlug(param: string | null): string | null {
  if (param) return param;
  if (typeof window === 'undefined') return null;
  const parts = window.location.hostname.split('.');
  if (parts.length >= 3 && !['www', 'app'].includes(parts[0])) return parts[0];
  return null;
}

export default function VacancyDetailPage() {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const vacancySlug = String(routeParams.slug ?? '');
  const empresa = useMemo(() => resolveSlug(searchParams.get('empresa')), [searchParams]);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    if (empresa) qs.set('empresa', empresa);
    fetch(`${API}/careers/vacancies/${vacancySlug}?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Vaga não encontrada ou encerrada.'))))
      .then((d) => { if (active) { setData(d); setLoading(false); } })
      .catch((e) => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [vacancySlug, empresa]);

  const suffix = empresa ? `?empresa=${empresa}` : '';
  const v = data?.vacancy;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          {data?.company.logoUrl && <img src={data.company.logoUrl} alt="" className="h-9 w-auto" />}
          <Link href={`/carreiras${suffix}`} className="text-sm font-semibold hover:underline">{data?.company.name ?? 'Carreiras'}</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-8">
        {loading && <div className="py-12 text-center text-slate-400">Carregando…</div>}
        {error && <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">{error} <Link href={`/carreiras${suffix}`} className="underline">Ver outras vagas</Link></div>}
        {v && (
          <>
            <Link href={`/carreiras${suffix}`} className="text-xs text-slate-400 hover:underline">← Todas as vagas</Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{v.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{[v.area, v.city || v.location, v.workMode ? MODE_LABEL[v.workMode] ?? v.workMode : null, v.contractType].filter(Boolean).join(' · ')}</p>
            {v.pcd && <span className="mt-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Vaga afirmativa PcD</span>}
            {v.salary && <p className="mt-2 text-sm font-medium">Faixa: {v.salary}</p>}

            <Section title="Descrição" text={v.description} />
            <Section title="Requisitos" text={v.requirements} />
            <Section title="Benefícios" text={v.benefits} />
            <Section title="Etapas do processo" text={v.processSteps} />

            <div className="mt-8 rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <button
                onClick={() => alert('A candidatura estará disponível em breve. Obrigado pelo interesse!')}
                className="w-full rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                Candidatar-se
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-400">Ao se candidatar, você concorda com o tratamento dos seus dados conforme a LGPD.</p>
            </div>
          </>
        )}
      </article>
    </main>
  );
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
    </section>
  );
}
