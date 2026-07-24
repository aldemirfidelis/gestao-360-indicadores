import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, moduleHighlights, publicMetadata, solutionPages, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Módulos do Gestão 360',
  description: 'Conheça os 14 módulos do Gestão 360 para rotina, estratégia, qualidade, segurança, pessoas, recrutamento, serviço pessoal, suprimentos, comunicação, atendimento e remuneração.',
  path: '/modulos',
});

export default function ModulosPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Módulos', description: metadata.description as string, path: '/modulos' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Módulos', path: '/modulos' }])]} />
      <PageHero eyebrow="14 módulos conectados" title="Cada área ganha profundidade sem virar um novo silo." description="O Gestão 360 organiza rotina, estratégia, qualidade, segurança, suprimentos e a jornada completa de pessoas sobre uma base comum de empresas, estrutura, usuários, permissões, histórico e auditoria." />
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Visão completa</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">O que cada módulo faz</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Os módulos podem ser liberados conforme a realidade de cada empresa e compartilham a mesma estrutura de acesso, rastreabilidade e governança.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {moduleHighlights.map((item) => (
              <article id={item.slug} key={item.slug} className="flex min-h-[316px] scroll-mt-24 flex-col border border-slate-200 bg-slate-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{item.eyebrow}</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                <ul className="mt-auto grid gap-2 pt-6">
                  {item.capabilities.map((capability) => (
                    <li key={capability} className="flex items-start gap-2 text-xs leading-5 text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {capability}
                    </li>
                  ))}
                </ul>
                {item.slug === 'seguranca-dos-alimentos' && (
                  <Link href="/solucoes/seguranca-dos-alimentos" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                    Ver fluxo 3D <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Capacidades que atravessam os módulos</h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            Indicadores, estratégia, planos de ação, documentos, auditorias e riscos se conectam a cargos, vagas, colaboradores, ponto, folha, compras e demais frentes sem duplicar cadastros e históricos.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {solutionPages.slice(0, 8).map((page) => (
              <Link key={page.path} href={page.path} className="border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 hover:border-slate-950">
                {page.title}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
