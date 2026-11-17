import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ListingGrid, PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, segmentPages, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Segmentos atendidos pelo Gestão 360',
  description:
    'Veja como o Gestão 360 pode apoiar indústria, agronegócio, alimentos e bebidas, serviços e gestão corporativa.',
  path: '/segmentos',
});

export default function SegmentosPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Segmentos',
            description: metadata.description as string,
            path: '/segmentos',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Segmentos', path: '/segmentos' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Segmentos"
        title="O contexto muda. A gestão continua conectada."
        description="Explore como processos, indicadores e planos podem apoiar a rotina da indústria, dos serviços e das áreas corporativas."
      />
      <section className="public-section">
        <div className="public-container">
          <ListingGrid pages={segmentPages} />
        </div>
      </section>
    </PublicShell>
  );
}
