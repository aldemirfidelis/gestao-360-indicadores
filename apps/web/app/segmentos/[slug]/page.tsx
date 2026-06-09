import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero, PublicPageBody } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, faqJsonLd, getSegment, publicMetadata, segmentPages, solutionPages, webPageJsonLd } from '@/lib/public-site';

export function generateStaticParams() {
  return segmentPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getSegment(slug);
  if (!page) return {};
  return publicMetadata({ title: page.seoTitle, description: page.description, path: page.path });
}

export default async function SegmentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getSegment(slug);
  if (!page) notFound();
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: page.title, description: page.description, path: page.path }), faqJsonLd(page.faq), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Segmentos', path: '/segmentos' }, { name: page.title, path: page.path }])]} />
      <PageHero eyebrow={page.eyebrow} title={page.title} description={page.summary} />
      <PublicPageBody page={page} related={solutionPages.slice(0, 3)} />
    </PublicShell>
  );
}
