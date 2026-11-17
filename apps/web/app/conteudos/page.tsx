import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ArticleListing, PageHero } from '@/components/marketing/content-blocks';
import { articlePages, breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Conteúdos sobre gestão e melhoria contínua | Gestão 360',
  description:
    'Artigos, guias de recursos e respostas sobre indicadores, estratégia, planos de ação, processos e melhoria contínua.',
  path: '/conteudos',
});
export default function ConteudosPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Conteúdos',
            description: metadata.description as string,
            path: '/conteudos',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Conteúdos', path: '/conteudos' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Conteúdos de gestão"
        title="Boas perguntas. Próximos passos mais claros."
        description="Leituras e orientações para estruturar indicadores, organizar os planos e conectar a rotina de gestão."
      />
      <section className="public-section">
        <div className="public-container">
          <div className="public-listing">
            {[
              [
                'Artigos',
                'Conceitos e práticas para acompanhar resultados e execução.',
                '/conteudos/artigos',
              ],
              [
                'Guias de recursos',
                'Entenda as ferramentas e suas aplicações na rotina da empresa.',
                '/conteudos/guias',
              ],
              [
                'Perguntas frequentes',
                'Tire dúvidas sobre a plataforma, o acesso e a avaliação.',
                '/conteudos/perguntas-frequentes',
              ],
            ].map(([title, text, href]) => (
              <Link href={href} key={href}>
                <span className="public-eyebrow">Explore por formato</span>
                <h2>{title}</h2>
                <p>{text}</p>
                <span className="public-text-link">
                  Explorar <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="public-section public-detail-band">
        <div className="public-container">
          <div className="public-section-heading">
            <span className="public-eyebrow">Para a sua próxima leitura</span>
            <h2>Gestão em prática</h2>
          </div>
          <ArticleListing articles={articlePages} />
        </div>
      </section>
    </PublicShell>
  );
}
