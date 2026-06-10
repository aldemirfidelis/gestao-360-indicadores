import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { articlePages, breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Conteúdos sobre gestão, indicadores e melhoria contínua',
  description: 'Artigos, guias e perguntas frequentes sobre indicadores, planejamento, planos de ação, auditorias, documentos, qualidade e governança.',
  path: '/conteudos',
});

export default function ConteudosPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Conteúdos', description: metadata.description as string, path: '/conteudos' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Conteúdos', path: '/conteudos' }])]} />
      <PageHero eyebrow="Conteúdos" title="Centro de conteúdo para gestão corporativa." description="Materiais públicos para ajudar gestores a estruturar indicadores, planos de ação, qualidade, documentos e melhoria contínua." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          <HubCard href="/conteudos/artigos" title="Artigos" text="Conteúdos práticos sobre temas de gestão e execução." />
          <HubCard href="/conteudos/guias" title="Guias" text="Materiais orientativos para estruturar rotinas e controles." />
          <HubCard href="/conteudos/perguntas-frequentes" title="Perguntas frequentes" text="Respostas objetivas para compradores e gestores." />
        </div>
        <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Artigos recentes</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {articlePages.map((article) => (
              <Link key={article.slug} href={article.path} className="border border-slate-200 bg-white p-5 hover:border-slate-950">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{article.category}</div>
                <h3 className="mt-3 text-lg font-semibold text-slate-950">{article.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{article.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function HubCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="border border-slate-200 bg-white p-6 hover:border-slate-950">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
    </Link>
  );
}
