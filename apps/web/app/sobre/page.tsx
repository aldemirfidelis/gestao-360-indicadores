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
            <p>O Gestão 360 é uma plataforma corporativa modular para gestão empresarial integrada. Ela conecta empresas, filiais, áreas, processos, indicadores, metas, reuniões, planos de ação, documentos, auditorias, riscos e evidências.</p>
            <p>O objetivo público do site e explicar a plataforma de forma clara, sem prometer resultados que dependem de implantação, maturidade de processo ou contexto da empresa.</p>
            <p>Dados de clientes, painéis, documentos e telas administrativas permanecem no portal autenticado e não fazem parte da arquitetura pública indexável.</p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
