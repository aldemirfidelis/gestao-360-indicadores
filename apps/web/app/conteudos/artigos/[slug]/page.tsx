import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { FaqBlock, PageHero } from '@/components/marketing/content-blocks';
import { articleJsonLd, articlePages, breadcrumbJsonLd, faqJsonLd, getArticle, publicMetadata } from '@/lib/public-site';

export function generateStaticParams() {
  return articlePages.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return publicMetadata({ title: article.seoTitle, description: article.description, path: article.path });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  return (
    <PublicShell>
      <JsonLd data={[articleJsonLd(article), faqJsonLd(article.faq), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Conteudos', path: '/conteudos' }, { name: 'Artigos', path: '/conteudos/artigos' }, { name: article.title, path: article.path }])]} />
      <PageHero eyebrow={article.category} title={article.title} description={article.intro} />
      <article className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="border-b border-slate-200 pb-6 text-sm text-slate-500">
            Por {article.author} • publicado em {article.publishedAt} • revisado em {article.updatedAt} • {article.readingTime}
          </div>
          <div className="mt-8 space-y-10">
            {article.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <div className="mt-4 space-y-4">
                  {section.body.map((paragraph) => <p key={paragraph} className="text-base leading-8 text-slate-700">{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-10 border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-semibold text-slate-950">Proximo passo</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">Veja as solucoes relacionadas para entender como esse tema pode ser operacionalizado dentro do Gestao 360.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {article.related.map((href) => <Link key={href} href={href} className="border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800">{href.replace('/solucoes/', '').replaceAll('-', ' ')}</Link>)}
            </div>
          </div>
        </div>
      </article>
      <FaqBlock faq={article.faq} />
    </PublicShell>
  );
}
