import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Suporte e evolução do Gestão 360',
  description: 'Conheça os canais e princípios de suporte do Gestão 360 para acompanhamento, evolução e melhoria contínua da plataforma.',
  path: '/suporte',
});

export default function SuportePage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Suporte', description: metadata.description as string, path: '/suporte' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Suporte', path: '/suporte' }])]} />
      <PageHero eyebrow="Suporte" title="Suporte orientado a uso real e evolução contínua." description="Apoio comercial e técnico deve considerar maturidade de gestão, módulos contratados, prioridades e segurança dos dados." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {['Dúvidas de uso', 'Ajustes de configuração', 'Evolução de conteúdo ? módulos'].map((title) => (
            <div key={title} className="border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Atendimento conforme contexto, contrato, permissão e ambiente da empresa.</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
