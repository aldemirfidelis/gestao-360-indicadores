import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Guias de gestão corporativa',
  description: 'Guias iniciais sobre indicadores, planos de ação, qualidade, auditorias, documentos, riscos e governança corporativa.',
  path: '/conteudos/guias',
});

export default function GuiasPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Guias', description: metadata.description as string, path: '/conteudos/guias' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Conteúdos', path: '/conteudos' }, { name: 'Guias', path: '/conteudos/guias' }])]} />
      <PageHero eyebrow="Guias" title="Guias públicos para estruturar a rotina de gestão." description="Este hub organiza temas de evolução editorial. Novos materiais devem ser publicados apenas quando estiverem completos e revisados." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {solutionPages.slice(0, 6).map((page) => (
            <Link key={page.path} href={page.path} className="border border-slate-200 bg-white p-5 hover:border-slate-950">
              <h2 className="text-xl font-semibold text-slate-950">Guia de {page.title.toLowerCase()}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{page.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
