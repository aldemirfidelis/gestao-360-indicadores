import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, moduleHighlights, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Modulos do Gestao 360',
  description: 'Conheca os modulos do Gestao 360 para Meu Dia, indicadores, planos, documentos, auditorias, riscos, automacoes, qualidade e administracao global.',
  path: '/modulos',
});

export default function ModulosPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Modulos', description: metadata.description as string, path: '/modulos' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Modulos', path: '/modulos' }])]} />
      <PageHero eyebrow="Modulos" title="Modulos conectados, sem transformar cada area em um silo." description="O Gestao 360 organiza modulos operacionais sobre uma base comum de empresas, usuarios, permissoes, historico e auditoria." />
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {moduleHighlights.map((item) => <div key={item} className="border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">{item}</div>)}
        </div>
      </section>
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Solucoes relacionadas</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {solutionPages.slice(0, 8).map((page) => (
              <a key={page.path} href={page.path} className="border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 hover:border-slate-950">
                {page.title}
              </a>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
