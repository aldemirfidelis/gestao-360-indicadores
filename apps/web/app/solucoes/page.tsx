import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ListingGrid, PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Solucoes de gestao corporativa integrada',
  description: 'Conheca as solucoes do Gestao 360 para indicadores, estrategia, planos de acao, qualidade, documentos, auditorias, riscos e dashboards.',
  path: '/solucoes',
});

export default function SolucoesPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Solucoes', description: metadata.description as string, path: '/solucoes' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Solucoes', path: '/solucoes' }])]} />
      <PageHero eyebrow="Solucoes" title="Gestao integrada para areas que precisam sair do controle fragmentado." description="Cada solucao tem pagina propria, metadados especificos e conteudo orientado a problemas reais de gestao." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ListingGrid pages={solutionPages} />
        </div>
      </section>
    </PublicShell>
  );
}
