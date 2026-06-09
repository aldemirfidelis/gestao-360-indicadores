import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ListingGrid, PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, segmentPages, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Segmentos atendidos pelo Gestao 360',
  description: 'Veja como o Gestao 360 pode apoiar industria, agronegocio, alimentos e bebidas, servicos e gestao corporativa.',
  path: '/segmentos',
});

export default function SegmentosPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Segmentos', description: metadata.description as string, path: '/segmentos' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Segmentos', path: '/segmentos' }])]} />
      <PageHero eyebrow="Segmentos" title="Gestao corporativa integrada para diferentes operacoes." description="Conteudo organizado por contexto de uso, sem prometer resultados sem diagnostico do processo da empresa." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ListingGrid pages={segmentPages} />
        </div>
      </section>
    </PublicShell>
  );
}
