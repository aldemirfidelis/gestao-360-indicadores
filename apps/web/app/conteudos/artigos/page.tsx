import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ArticleListing, PageHero } from '@/components/marketing/content-blocks';
import { articlePages, breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Artigos sobre indicadores e melhoria contínua | Gestão 360',
  description:
    'Leituras sobre definição de indicadores, planos de ação, análise e acompanhamento da melhoria.',
  path: '/conteudos/artigos',
});
export default function ArtigosPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Artigos',
            description: metadata.description as string,
            path: '/conteudos/artigos',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Conteúdos', path: '/conteudos' },
            { name: 'Artigos', path: '/conteudos/artigos' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Artigos"
        title="Ideias para transformar controle em rotina de gestão."
        description="Explore conceitos e práticas de indicadores, planos e melhoria contínua para levar à próxima conversa da equipe."
      />
      <section className="public-section">
        <div className="public-container">
          <ArticleListing articles={articlePages} />
        </div>
      </section>
    </PublicShell>
  );
}
