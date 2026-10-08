import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ListingGrid, PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, moduleHighlights, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Soluções de gestão corporativa integrada',
  description: 'Conheça as soluções do Gestão 360 para BSC, indicadores, dados, execução e gestão de prêmio.',
  path: '/solucoes',
});

export default function SolucoesPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Soluções', description: metadata.description as string, path: '/solucoes' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Soluções', path: '/solucoes' }])]} />
      <PageHero eyebrow="Soluções" title="Conecte estratégia, dados e resultados." description="Do trabalho diário ao BSC, dos indicadores às ações e ao reconhecimento: acompanhe os resultados com dados conectados." />
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Plataforma atual</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Quatro frentes sobre uma base comum</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {moduleHighlights.map((module) => (
              <Link key={module.slug} href={`/modulos#${module.slug}`} className="group flex min-h-[192px] flex-col border border-slate-200 bg-slate-50 p-5 hover:border-slate-950">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{module.eyebrow}</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-4 text-xs font-semibold text-slate-950">
                  Entender o módulo <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Capacidades integradas</p>
          <h2 className="mb-8 text-3xl font-semibold tracking-tight text-slate-950">Soluções para problemas específicos de gestão</h2>
          <ListingGrid pages={solutionPages} />
        </div>
      </section>
    </PublicShell>
  );
}
