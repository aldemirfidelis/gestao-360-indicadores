import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { articlePages, breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Artigos sobre indicadores, planos de acao e qualidade',
  description: 'Artigos do Gestao 360 para gestores que buscam melhorar indicadores, planos de acao, auditorias, documentos e governanca.',
  path: '/conteudos/artigos',
});

export default function ArtigosPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Artigos', description: metadata.description as string, path: '/conteudos/artigos' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Conteudos', path: '/conteudos' }, { name: 'Artigos', path: '/conteudos/artigos' }])]} />
      <PageHero eyebrow="Artigos" title="Leituras para transformar controle em rotina de gestao." description="Conteudos originais, com autoria institucional e data de revisao, sem textos ocultos ou promessas artificiais." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {articlePages.map((article) => (
            <Link key={article.slug} href={article.path} className="border border-slate-200 bg-white p-5 hover:border-slate-950">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{article.category}</div>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">{article.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{article.description}</p>
              <div className="mt-5 text-xs text-slate-500">{article.readingTime} • revisado em {article.updatedAt}</div>
            </Link>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
