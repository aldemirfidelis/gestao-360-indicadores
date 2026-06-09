import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Sobre o Gestao 360',
  description: 'Conheca o posicionamento do Gestao 360 como plataforma SaaS B2B modular para gestao corporativa integrada.',
  path: '/sobre',
});

export default function SobrePage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Sobre', description: metadata.description as string, path: '/sobre' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Sobre', path: '/sobre' }])]} />
      <PageHero eyebrow="Sobre" title="Uma plataforma para conectar estrategia, execucao e rastreabilidade." description="O Gestao 360 foi estruturado para empresas que precisam reduzir controles paralelos e acompanhar a rotina de gestao em um ambiente unico." />
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6 text-base leading-8 text-slate-700">
            <p>O Gestao 360 e uma plataforma SaaS B2B modular para gestao corporativa integrada. Ela conecta empresas, filiais, areas, processos, indicadores, metas, reunioes, planos de acao, documentos, auditorias, riscos e evidencias.</p>
            <p>O objetivo publico do site e explicar a plataforma de forma clara, sem prometer resultados que dependem de implantacao, maturidade de processo ou contexto da empresa.</p>
            <p>Dados de clientes, dashboards, documentos e telas administrativas permanecem no portal autenticado e nao fazem parte da arquitetura publica indexavel.</p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
