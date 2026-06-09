import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { FaqBlock, PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, faqJsonLd, faqPage, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Perguntas frequentes sobre o Gestao 360',
  description: 'Respostas sobre plataforma, paginas publicas, dados privados, IA assistiva, demonstracao e modulos do Gestao 360.',
  path: '/conteudos/perguntas-frequentes',
});

export default function PerguntasFrequentesPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Perguntas frequentes', description: metadata.description as string, path: '/conteudos/perguntas-frequentes' }), faqJsonLd(faqPage), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Conteudos', path: '/conteudos' }, { name: 'Perguntas frequentes', path: '/conteudos/perguntas-frequentes' }])]} />
      <PageHero eyebrow="FAQ" title="Perguntas frequentes sobre o Gestao 360." description="Respostas claras para quem avalia uma plataforma de gestao integrada." />
      <FaqBlock faq={faqPage} />
    </PublicShell>
  );
}
