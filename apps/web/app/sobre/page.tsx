import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Sobre o Gestão 360',
  description: 'Conheça o posicionamento do Gestão 360 como plataforma corporativa integrada para gestão empresarial.',
  path: '/sobre',
});

export default function SobrePage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Sobre', description: metadata.description as string, path: '/sobre' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Sobre', path: '/sobre' }])]} />
      <PageHero eyebrow="Sobre" title="Uma plataforma para conectar estratégia, execução e rastreabilidade." description="O Gestão 360 foi estruturado para empresas que precisam reduzir controles paralelos e acompanhar a rotina de gestão em um ambiente único." />
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6 text-base leading-8 text-slate-700">
            <p>O Gestão 360 conecta planejamento estratégico, processos, indicadores, tarefas, reuniões, planos de ação, projetos e documentos. A estrutura de empresas e áreas mantém as responsabilidades e o acesso associados ao trabalho.</p>
            <p>A proposta é aproximar a direção definida pela liderança da execução acompanhada pelas equipes. Os vínculos entre registros ajudam a recuperar o contexto das decisões, investigar desvios e verificar as melhorias.</p>
            <p>Conheça a plataforma na demonstração com dados fictícios ou converse com a equipe para definir o escopo de uma avaliação na sua empresa.</p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
