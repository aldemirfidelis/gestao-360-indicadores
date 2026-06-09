import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero, PublicPageBody } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, faqJsonLd, getSolution, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';

export function generateStaticParams() {
  return solutionPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getSolution(slug);
  if (!page) return {};
  return publicMetadata({ title: page.seoTitle, description: page.description, path: page.path });
}

export default async function SolutionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getSolution(slug);
  if (!page) notFound();
  const related = solutionPages.filter((item) => item.slug !== page.slug).slice(0, 3);
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: page.title, description: page.description, path: page.path }), faqJsonLd(page.faq), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Solucoes', path: '/solucoes' }, { name: page.title, path: page.path }])]} />
      <PageHero eyebrow={page.eyebrow} title={page.title} description={page.summary} />
      <PublicPageBody page={page} related={related} />
    </PublicShell>
  );
}
