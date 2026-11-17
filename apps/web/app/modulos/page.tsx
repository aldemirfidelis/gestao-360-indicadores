import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { activeProductModules, productGroups } from '@/lib/marketing-catalog';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Módulos e recursos da plataforma | Gestão 360',
  description:
    'Explore estratégia, indicadores, processos, documentos, tarefas, projetos e reuniões. Conheça os recursos disponíveis e suas conexões.',
  path: '/modulos',
});
export default function ModulosPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Módulos',
            description: metadata.description as string,
            path: '/modulos',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Módulos', path: '/modulos' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Explore a plataforma"
        title="Profundidade em cada frente. Contexto entre todas elas."
        description="Organize a gestão por desafios de negócio, com uma base compartilhada de estrutura, acesso e histórico."
      />
      <div className="public-container">
        {productGroups.map((group) => (
          <section className="public-catalog-group" key={group.id}>
            <h2>{group.label}</h2>
            <p>{group.description}</p>
            <div className="public-catalog-grid">
              {activeProductModules
                .filter((module) => module.group === group.id)
                .map((module) => (
                  <article id={module.slug} key={module.slug}>
                    <span className="public-eyebrow">{module.eyebrow}</span>
                    <h3>{module.title}</h3>
                    <p>{module.description}</p>
                    <div className="public-tags">
                      {module.capabilities.map((capability) => (
                        <span key={capability}>{capability}</span>
                      ))}
                    </div>
                    <p className="catalog-connection">{module.connection}</p>
                    {!module.href.startsWith('/modulos#') && (
                      <Link href={module.href} className="public-text-link">
                        Conheça a solução <ArrowRight size={16} />
                      </Link>
                    )}
                  </article>
                ))}
            </div>
          </section>
        ))}
        <p className="public-scope-note">
          A apresentação reúne os recursos disponíveis no escopo atual. A liberação depende do
          plano, dos módulos e das permissões. Pacotes especializados de RH, suprimentos, segurança,
          auditorias e premiação não integram a oferta atual. Confirme o escopo da sua empresa na
          avaliação e na proposta.
        </p>
      </div>
    </PublicShell>
  );
}
