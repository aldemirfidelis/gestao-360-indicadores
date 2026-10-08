import type { Metadata } from 'next';
import { DemoAccess } from '@/components/marketing/demo-access';
import { PageHero } from '@/components/marketing/content-blocks';
import { JsonLd } from '@/components/marketing/json-ld';
import { PublicShell } from '@/components/marketing/public-shell';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Acesse a Demonstração',
  description:
    'Explore o BSC, indicadores, resultados e gestão de prêmio com dados fictícios na Empresa Demonstração.',
  path: '/demonstracao',
});

export default function DemonstracaoPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Acesse a Demonstração',
            description: metadata.description as string,
            path: '/demonstracao',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Acesse a Demonstração', path: '/demonstracao' },
          ]),
        ]}
      />
      {/* Sem o CTA: o acesso direto está logo abaixo. */}
      <PageHero
        eyebrow="Demonstração"
        title="Veja o Gestão 360 aplicado à sua operação."
        description="Entre com um clique e acompanhe a estratégia, os resultados e a execução em uma empresa fictícia."
        showDemoCta={false}
      />
      <section className="bg-slate-50 px-4 py-16"><DemoAccess /></section>
    </PublicShell>
  );
}
