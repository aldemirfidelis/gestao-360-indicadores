import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ListingGrid, PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Guias de recursos e aplicações | Gestão 360',
  description:
    'Entenda os recursos de estratégia, indicadores, processos, projetos e documentos e veja exemplos de aplicação.',
  path: '/conteudos/guias',
});
export default function GuiasPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Guias',
            description: metadata.description as string,
            path: '/conteudos/guias',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Conteúdos', path: '/conteudos' },
            { name: 'Guias', path: '/conteudos/guias' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Guias de recursos"
        title="Encontre um ponto de partida para a sua gestão."
        description="Escolha um tema para entender o desafio, conhecer as ferramentas disponíveis e explorar exemplos de uso."
      />
      <section className="public-section">
        <div className="public-container">
          <ListingGrid pages={solutionPages} />
        </div>
      </section>
    </PublicShell>
  );
}
