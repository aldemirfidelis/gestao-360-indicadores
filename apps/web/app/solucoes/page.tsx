import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ListingGrid, PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Soluções de gestão corporativa integrada',
  description: 'Conheça as soluções do Gestão 360 para indicadores, estratégia, planos de ação, qualidade, documentos, auditorias, riscos e painéis.',
  path: '/solucoes',
});

export default function SolucoesPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Soluções', description: metadata.description as string, path: '/solucoes' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Soluções', path: '/solucoes' }])]} />
      <PageHero eyebrow="Soluções" title="Gestão integrada para áreas que precisam sair do controle fragmentado." description="Cada solução tem página própria, metadados específicos e conteúdo orientado a problemas reais de gestão." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ListingGrid pages={solutionPages} />
        </div>
      </section>
    </PublicShell>
  );
}
