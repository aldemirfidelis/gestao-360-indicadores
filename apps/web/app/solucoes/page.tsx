import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ListingGrid, PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Soluções para conectar a gestão | Gestão 360',
  description:
    'Encontre soluções para estratégia, indicadores, processos, documentos, melhoria contínua, projetos e governança.',
  path: '/solucoes',
});
export default function SolucoesPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Soluções',
            description: metadata.description as string,
            path: '/solucoes',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Soluções', path: '/solucoes' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Soluções de gestão"
        title="Seu desafio é o ponto de partida."
        description="Da definição dos objetivos ao acompanhamento da execução, encontre as ferramentas e os vínculos que fazem sentido para a sua operação."
      />
      <section className="public-section">
        <div className="public-container">
          <ListingGrid pages={solutionPages} />
        </div>
      </section>
    </PublicShell>
  );
}
