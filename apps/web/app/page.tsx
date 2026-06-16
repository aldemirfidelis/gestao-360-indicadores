import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, ClipboardList, FileSearch, LineChart, Network, ShieldCheck, Workflow } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { DemoLink } from '@/components/marketing/demo-link';
import { WhatsAppButton } from '@/components/marketing/whatsapp-button';
import {
  faqJsonLd,
  moduleHighlights,
  organizationJsonLd,
  publicMetadata,
  segmentPages,
  softwareJsonLd,
  solutionPages,
  webPageJsonLd,
  websiteJsonLd,
} from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Gestão 360 | Gestão estratégica, indicadores e planos de ação',
  description:
    'Plataforma SaaS B2B para gestão corporativa integrada: indicadores, planejamento estratégico, planos de ação, documentos, auditorias, riscos e melhoria contínua.',
  path: '/',
});

const challenges = [
  'Indicadores espalhados em planilhas e sem responsável claro.',
  'Planos de ação sem evidência, histórico ou verificação de eficácia.',
  'Auditorias, documentos, riscos e não conformidades tratados em controles isolados.',
  'Gestores sem visão diária das prioridades e bloqueios da equipe.',
];

const flow = [
  ['Estruture', 'Empresas, filiais, áreas, setores, processos e permissões.'],
  ['Acompanhe', 'Indicadores, metas, painéis, reuniões e desvios.'],
  ['Trate', 'Análise de causa, planos de ação, evidências e aprovações.'],
  ['Aprenda', 'Histórico, auditoria, visão 360, riscos e recomendações assistidas.'],
];

const faq = [
  {
    question: 'O Gestão 360 expõe dados de clientes em páginas públicas?',
    answer:
      'Não. O conteúdo público é institucional. Painéis, registros, documentos, APIs e áreas administrativas exigem autenticação e autorização.',
  },
  {
    question: 'A plataforma substitui todos os sistemas da empresa?',
    answer:
      'Não necessariamente. O Gestão 360 atua como camada integrada de gestão, acompanhamento, evidências e execução. Integrações podem conectar sistemas existentes quando fizer sentido.',
  },
  {
    question: 'Como funciona a demonstração?',
    answer:
      'A demonstração permite conhecer a plataforma com dados de exemplo e avaliar quais módulos fazem sentido para a rotina da empresa.',
  },
];

export default function HomePage() {
  return (
    <PublicShell>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd(), softwareJsonLd(), webPageJsonLd({ title: 'Gestão 360', description: metadata.description as string, path: '/' }), faqJsonLd(faq)]} />
      <section className="relative min-h-[calc(100svh-5rem)] overflow-hidden bg-slate-950 text-white lg:min-h-[620px]">
        <div className="absolute inset-0" aria-hidden="true">
          <Image
            src="/brand/landing-hero-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.92)_0%,rgba(15,23,42,0.82)_42%,rgba(15,23,42,0.38)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/75 to-transparent" />
        </div>
        <div className="relative mx-auto flex min-h-[calc(100svh-5rem)] max-w-7xl items-center px-4 py-14 sm:px-6 lg:min-h-[620px] lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Plataforma SaaS B2B modular</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              Gestão estratégica, indicadores e planos de ação conectados em uma única plataforma.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              O Gestão 360 integra planejamento, acompanhamento, tratativas, evidências e rastreabilidade para transformar dados corporativos em decisões acompanháveis.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <DemoLink source="home_hero" className="inline-flex h-12 items-center justify-center gap-2 bg-emerald-400 px-6 text-sm font-semibold text-slate-950 hover:bg-emerald-300">
                Acesse a Demonstração
                <ArrowRight className="h-4 w-4" />
              </DemoLink>
              <Link href="/modulos" className="inline-flex h-12 items-center justify-center border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white hover:text-slate-950">
                Conhecer módulos
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr,1.2fr] lg:px-8">
          <SectionIntro eyebrow="Problemas reais" title="Menos controles paralelos. Mais contexto para decidir." />
          <div className="grid gap-3 sm:grid-cols-2">
            {challenges.map((item) => (
              <div key={item} className="flex gap-3 border border-slate-200 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro eyebrow="Soluções" title="Páginas e módulos pensados para a rotina de gestão." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {solutionPages.slice(0, 9).map((page) => (
              <Link key={page.slug} href={page.path} className="group border border-slate-200 bg-white p-5 hover:border-slate-950">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{page.eyebrow}</div>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">{page.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{page.summary}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  Ver solução <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr,1.1fr] lg:px-8">
          <div>
            <SectionIntro eyebrow="Fluxo integrado" title="Da estratégia à execução, com trilha de auditoria." />
            <p className="mt-5 text-base leading-7 text-slate-600">
              A plataforma não duplica a operação em painéis soltos. Ela conecta registros de origem, responsáveis, prazos, histórico, impactos e evidências.
            </p>
          </div>
          <div className="grid gap-3">
            {flow.map(([title, text], index) => (
              <div key={title} className="grid grid-cols-[48px,1fr] gap-4 border border-slate-200 bg-slate-50 p-4">
                <div className="grid h-12 w-12 place-items-center bg-slate-950 text-sm font-semibold text-white">{index + 1}</div>
                <div>
                  <h2 className="font-semibold text-slate-950">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro eyebrow="Módulos disponíveis" title="Uma base modular para crescer sem perder governança." inverted />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {moduleHighlights.map((item, index) => {
              const icons = [LineChart, Network, Workflow, ShieldCheck, FileSearch, ClipboardList];
              const Icon = icons[index] ?? LineChart;
              return (
                <div key={item} className="border border-white/10 bg-white/[0.03] p-5">
                  <Icon className="h-5 w-5 text-emerald-300" />
                  <p className="mt-4 text-sm leading-6 text-slate-200">{item}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro eyebrow="Segmentos" title="Aplicável a diferentes operações corporativas." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {segmentPages.map((segment) => (
              <Link key={segment.slug} href={segment.path} className="border border-slate-200 p-5 hover:border-slate-950">
                <h2 className="text-lg font-semibold">{segment.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{segment.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr,1.1fr] lg:px-8">
          <div>
            <SectionIntro eyebrow="Demonstração" title="Acesse um ambiente de exemplo e veja a plataforma em uso." />
            <p className="mt-5 text-sm leading-6 text-slate-600">
              Use a demonstração para navegar por indicadores, planos, documentos, auditorias e rotinas de acompanhamento com dados fictícios.
            </p>
          </div>
          <div className="border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Entre direto na demonstração.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              O acesso abre a tela de entrada com a conta de demonstração já preenchida. Assim você pode conhecer o produto antes de conversar com a equipe.
            </p>
            <DemoLink source="home_demo_section" className="mt-6 inline-flex h-12 items-center justify-center gap-2 bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-emerald-700">
              Acesse a Demonstração
              <ArrowRight className="h-4 w-4" />
            </DemoLink>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionIntro eyebrow="Perguntas frequentes" title="Respostas diretas para compradores e gestores." />
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {faq.map((item) => (
              <div key={item.question} className="py-5">
                <h2 className="font-semibold text-slate-950">{item.question}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <WhatsAppButton />
    </PublicShell>
  );
}

function SectionIntro({ eyebrow, title, inverted = false }: { eyebrow: string; title: string; inverted?: boolean }) {
  return (
    <div>
      <p className={inverted ? 'text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300' : 'text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700'}>{eyebrow}</p>
      <h2 className={inverted ? 'mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl' : 'mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl'}>{title}</h2>
    </div>
  );
}
