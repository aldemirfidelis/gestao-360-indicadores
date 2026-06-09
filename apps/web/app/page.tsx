import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, ClipboardList, FileSearch, LineChart, Network, ShieldCheck, Workflow } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { ContactForm } from '@/components/marketing/contact-form';
import {
  WHATSAPP_URL,
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
  title: 'Gestao 360 | Gestao estrategica, indicadores e planos de acao',
  description:
    'Plataforma SaaS B2B para gestao corporativa integrada: indicadores, planejamento estrategico, planos de acao, documentos, auditorias, riscos e melhoria continua.',
  path: '/',
});

const challenges = [
  'Indicadores espalhados em planilhas e sem responsavel claro.',
  'Planos de acao sem evidencia, historico ou verificacao de eficacia.',
  'Auditorias, documentos, riscos e nao conformidades tratados em controles isolados.',
  'Gestores sem visao diaria das prioridades e bloqueios da equipe.',
];

const flow = [
  ['Estruture', 'Empresas, filiais, areas, setores, processos e permissoes.'],
  ['Acompanhe', 'Indicadores, metas, dashboards, reunioes e desvios.'],
  ['Trate', 'Analise de causa, planos de acao, evidencias e aprovacoes.'],
  ['Aprenda', 'Historico, auditoria, visao 360, riscos e recomendacoes assistidas.'],
];

const faq = [
  {
    question: 'O Gestao 360 expõe dados de clientes em paginas publicas?',
    answer:
      'Nao. O conteudo publico e institucional. Dashboards, registros, documentos, APIs e areas administrativas exigem autenticacao e autorizacao.',
  },
  {
    question: 'A plataforma substitui todos os sistemas da empresa?',
    answer:
      'Nao necessariamente. O Gestao 360 atua como camada integrada de gestao, acompanhamento, evidencias e execucao. Integracoes podem conectar sistemas existentes quando fizer sentido.',
  },
  {
    question: 'Como funciona a demonstracao?',
    answer:
      'A equipe entende o contexto da empresa, apresenta os modulos relevantes e indica um caminho de implantacao sem prometer resultados sem avaliacao previa.',
  },
];

export default function HomePage() {
  return (
    <PublicShell>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd(), softwareJsonLd(), webPageJsonLd({ title: 'Gestao 360', description: metadata.description as string, path: '/' }), faqJsonLd(faq)]} />
      <section className="relative min-h-[680px] overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-90" aria-hidden="true">
          <div className="h-full w-full bg-[linear-gradient(115deg,rgba(15,23,42,0.96)_0%,rgba(15,23,42,0.78)_43%,rgba(20,184,166,0.32)_100%)]" />
          <div className="absolute inset-y-0 right-0 hidden w-[58%] border-l border-white/10 bg-slate-900/70 lg:block">
            <div className="grid h-full grid-cols-2 gap-px bg-white/10 p-8">
              {['Indicadores fora da meta', 'Planos em atraso', 'Riscos criticos', 'Auditorias abertas', 'Documentos em revisao', 'Meu Dia'].map((label, index) => (
                <div key={label} className="bg-slate-950/70 p-5">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div>
                  <div className="mt-5 h-2 bg-slate-700">
                    <div className={index % 2 === 0 ? 'h-2 w-2/3 bg-emerald-400' : 'h-2 w-1/2 bg-amber-400'} />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <span className="h-12 bg-white/10" />
                    <span className="h-12 bg-white/10" />
                    <span className="h-12 bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Plataforma SaaS B2B modular</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
              Gestao estrategica, indicadores e planos de acao conectados em uma unica plataforma.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              O Gestao 360 integra planejamento, acompanhamento, tratativas, evidencias e rastreabilidade para transformar dados corporativos em decisoes acompanhaveis.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contato" className="inline-flex h-12 items-center justify-center gap-2 bg-emerald-400 px-6 text-sm font-semibold text-slate-950 hover:bg-emerald-300">
                Solicitar demonstracao
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white hover:text-slate-950">
                Falar pelo WhatsApp
              </a>
              <Link href="/modulos" className="inline-flex h-12 items-center justify-center border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white hover:text-slate-950">
                Conhecer modulos
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
          <SectionIntro eyebrow="Solucoes" title="Paginas e modulos pensados para a rotina de gestao." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {solutionPages.slice(0, 9).map((page) => (
              <Link key={page.slug} href={page.path} className="group border border-slate-200 bg-white p-5 hover:border-slate-950">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{page.eyebrow}</div>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">{page.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{page.summary}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  Ver solucao <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr,1.1fr] lg:px-8">
          <div>
            <SectionIntro eyebrow="Fluxo integrado" title="Da estrategia a execucao, com trilha de auditoria." />
            <p className="mt-5 text-base leading-7 text-slate-600">
              A plataforma nao duplica a operacao em paineis soltos. Ela conecta registros de origem, responsaveis, prazos, historico, impactos e evidencias.
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
          <SectionIntro eyebrow="Modulos disponiveis" title="Uma base modular para crescer sem perder governanca." inverted />
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
          <SectionIntro eyebrow="Segmentos" title="Aplicavel a diferentes operacoes corporativas." />
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
            <SectionIntro eyebrow="Contato" title="Veja como o Gestao 360 se encaixa na sua rotina." />
            <p className="mt-5 text-sm leading-6 text-slate-600">
              Informe seu contexto. O retorno comercial deve focar nos modulos que ja existem e no caminho realista de implantacao.
            </p>
          </div>
          <div className="border border-slate-200 bg-white p-5">
            <ContactForm compact />
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
