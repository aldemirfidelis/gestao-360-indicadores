import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Headphones,
  ListTodo,
  Megaphone,
  ShieldCheck,
  Trophy,
  UsersRound,
  UtensilsCrossed,
  Warehouse,
} from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { DemoLink } from '@/components/marketing/demo-link';
import { WhatsAppButton } from '@/components/marketing/whatsapp-button';
import { IsometricFoodFlowPreview } from '@/components/marketing/isometric-food-flow-preview';
import {
  faqJsonLd,
  moduleHighlights,
  organizationJsonLd,
  publicMetadata,
  segmentPages,
  softwareJsonLd,
  webPageJsonLd,
  websiteJsonLd,
} from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Gestão 360 | Plataforma modular de gestão empresarial',
  description:
    'Integre estratégia, execução, qualidade, segurança, pessoas, comunicação, atendimento e remuneração variável em 11 módulos conectados.',
  path: '/',
});

const challenges = [
  'Prioridades, aprovações e tarefas espalhadas entre mensagens e planilhas.',
  'Estratégia, indicadores, desvios e planos sem uma visão executiva comum.',
  'Qualidade, segurança e compliance operando em controles isolados.',
  'Pessoas, comunicação e remuneração sem dados e fluxos conectados.',
];

const flow = [
  ['Organize', 'Empresas, estrutura, pessoas, processos, módulos e permissões.'],
  ['Enxergue', 'Painéis, prioridades, indicadores, riscos, chamados e pendências.'],
  ['Execute', 'Tarefas, aprovações, planos, monitoramentos e ritos de gestão.'],
  ['Evolua', 'Evidências, histórico, auditoria, métricas e inteligência assistida.'],
];

const solutionPillars = [
  {
    eyebrow: 'Rotina e execução',
    title: 'Trabalho organizado do início ao fim',
    summary:
      'Meu Dia, Tarefas e Central de Atendimento colocam prioridades, pendências e solicitações no fluxo certo, com contexto e acompanhamento.',
    modules: ['Meu Dia', 'Tarefas', 'Central de Atendimento'],
    href: '/modulos#meu-dia',
  },
  {
    eyebrow: 'Estratégia e desempenho',
    title: 'Decisões sustentadas por dados',
    summary:
      'Gestão à Vista conecta painel executivo, estratégia, indicadores, desvios, planos de ação, reuniões mensais e OKRs.',
    modules: ['Gestão à Vista'],
    href: '/modulos#gestao-a-vista',
  },
  {
    eyebrow: 'Governança e conformidade',
    title: 'Controle sem perder agilidade',
    summary:
      'Administração e Qualidade e Compliance integram permissões, automações, riscos, auditorias, documentos, processos e impactos.',
    modules: ['Administração', 'Qualidade e Compliance'],
    href: '/modulos#qualidade-e-compliance',
  },
  {
    eyebrow: 'Operação segura',
    title: 'Segurança aplicada ao processo real',
    summary:
      'Gerencie segurança dos alimentos com APPCC e fluxo 3D, além de portarias, acessos, rondas, ocorrências e ativos patrimoniais.',
    modules: ['Segurança dos Alimentos', 'Segurança Patrimonial'],
    href: '/modulos#seguranca-dos-alimentos',
  },
  {
    eyebrow: 'Pessoas e reconhecimento',
    title: 'Estrutura, remuneração e prêmio',
    summary:
      'Cargos e Salários organiza quadro, faixas e orçamento; Gestão de Prêmio conduz regras, apuração, espelhos e integração com a folha.',
    modules: ['Cargos e Salários', 'Gestão de Prêmio'],
    href: '/modulos#cargos-e-salarios',
  },
  {
    eyebrow: 'Comunicação e engajamento',
    title: 'Informação que chega e gera retorno',
    summary:
      'Comunicados, campanhas, pesquisas, confirmações, métricas e chat corporativo conectam a empresa em múltiplos canais.',
    modules: ['Comunicação'],
    href: '/modulos#comunicacao',
  },
];

const moduleIcons: Record<string, LucideIcon> = {
  'meu-dia': ListTodo,
  tarefas: ClipboardCheck,
  'central-de-atendimento': Headphones,
  'gestao-a-vista': BarChart3,
  administracao: BriefcaseBusiness,
  'qualidade-e-compliance': ShieldCheck,
  'seguranca-dos-alimentos': UtensilsCrossed,
  'seguranca-patrimonial': Warehouse,
  'cargos-e-salarios': UsersRound,
  comunicacao: Megaphone,
  'gestao-de-premio': Trophy,
};

const faq = [
  {
    question: 'Quais módulos fazem parte do Gestão 360?',
    answer:
      'A plataforma reúne Meu Dia, Tarefas, Central de Atendimento, Gestão à Vista, Administração, Qualidade e Compliance, Segurança dos Alimentos, Segurança Patrimonial, Cargos e Salários, Comunicação e Gestão de Prêmio.',
  },
  {
    question: 'Todos os módulos precisam ser contratados e liberados de uma vez?',
    answer:
      'Não. O Gestão 360 é modular: cada empresa pode trabalhar com os módulos adequados à sua operação, mantendo uma base comum de usuários, permissões, histórico e auditoria.',
  },
  {
    question: 'Os dados da empresa ficam disponíveis em páginas públicas?',
    answer:
      'Não. O conteúdo público é institucional. Painéis, registros, documentos, chamados, APIs e áreas administrativas exigem autenticação e autorização.',
  },
  {
    question: 'Como funciona a demonstração?',
    answer:
      'A demonstração permite navegar por um ambiente com dados de exemplo e conhecer os módulos antes de conversar com a equipe.',
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">11 módulos. Uma gestão conectada.</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              Uma plataforma para enxergar, executar e governar toda a operação.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              O Gestão 360 conecta estratégia, tarefas, qualidade, segurança, pessoas, comunicação, atendimento e remuneração variável em uma rotina rastreável.
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
          <SectionIntro eyebrow="Soluções" title="Frentes de gestão que trabalham como uma só plataforma." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {solutionPillars.map((pillar) => (
              <Link key={pillar.title} href={pillar.href} className="group flex min-h-[286px] flex-col border border-slate-200 bg-white p-6 hover:border-slate-950">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{pillar.eyebrow}</div>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">{pillar.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{pillar.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {pillar.modules.map((module) => (
                    <span key={module} className="border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {module}
                    </span>
                  ))}
                </div>
                <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-slate-950">
                  Conhecer módulos <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr,1.1fr] lg:px-8">
          <div>
            <SectionIntro eyebrow="Fluxo integrado" title="Da estrutura à execução, sem perder contexto." />
            <p className="mt-5 text-base leading-7 text-slate-600">
              Os módulos compartilham empresas, usuários, permissões, responsáveis, prazos, histórico e evidências. A informação nasce uma vez e segue conectada à decisão.
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
          <SectionIntro eyebrow="Módulos disponíveis" title="11 módulos explicados de forma direta." inverted />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {moduleHighlights.map((item) => {
              const Icon = moduleIcons[item.slug] ?? BarChart3;
              return (
                <Link
                  key={item.slug}
                  href={`/modulos#${item.slug}`}
                  className="group flex min-h-[292px] flex-col border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-emerald-300/60 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-10 w-10 place-items-center border border-emerald-300/20 bg-emerald-300/10">
                      <Icon className="h-5 w-5 text-emerald-300" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">{item.eyebrow}</span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-white">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {item.capabilities.map((capability) => (
                      <span key={capability} className="border border-white/10 px-2 py-1 text-[11px] text-slate-300">
                        {capability}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_48%,#ecfeff_100%)] py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.78fr,1.22fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Destaque do portal</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              Novo fluxo 3D isométrico
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              A linha de produção virou um mapa vivo da segurança dos alimentos.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              O fluxograma interativo representa cada etapa da operação em 3D, sinaliza pontos críticos de controle e aproxima o APPCC do processo que acontece no chão de fábrica.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-slate-700">
              {[
                'Gire, aproxime e reposicione as etapas do processo.',
                'Destaque visualmente PCCs e pontos que exigem controle.',
                'Conecte o fluxo a perigos, monitoramentos, cadeia e recall.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="leading-6">{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/solucoes/seguranca-dos-alimentos" className="mt-8 inline-flex h-11 items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
              Conhecer Segurança dos Alimentos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <IsometricFoodFlowPreview />
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
            <SectionIntro eyebrow="Conheça o portal" title="Escolha como deseja avaliar o Gestão 360." />
            <p className="mt-5 text-sm leading-6 text-slate-600">
              Navegue imediatamente com dados de exemplo ou solicite um trial de 30 dias preparado para a realidade da sua empresa.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Demonstração imediata</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Entre agora no ambiente com dados simulados e conheça os módulos sem configuração inicial.
              </p>
              <DemoLink source="home_demo_section" className="mt-auto inline-flex h-12 items-center justify-center gap-2 bg-slate-950 px-5 pt-0 text-sm font-semibold text-white hover:bg-emerald-700">
                Acessar demonstração
                <ArrowRight className="h-4 w-4" />
              </DemoLink>
            </div>
            <div className="flex flex-col border border-emerald-300 bg-emerald-50 p-6">
              <CalendarDays className="h-7 w-7 text-emerald-700" />
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">Trial de 30 dias</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Solicite um ambiente de avaliação e converse com nossa equipe sobre os módulos mais relevantes.
              </p>
              <Link href="/teste-gratis" className="mt-6 inline-flex h-12 items-center justify-center gap-2 bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
                Solicitar meu trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
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

      <section className="bg-slate-50 py-20 border-t border-slate-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 xl:grid-cols-[0.68fr,1.32fr] xl:px-8">
          <div>
            <SectionIntro eyebrow="Atendimento" title="Precisa falar com a equipe do Gestão 360?" />
            <p className="mt-5 text-sm leading-6 text-slate-600">
              Nosso atendimento está disponível para suporte, dúvidas, solicitações comerciais e relacionamento com clientes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex min-h-[196px] min-w-0 flex-col border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-950 text-sm">Suporte</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">Para suporte técnico ou dúvidas de uso:</p>
              <Link href="/suporte#formulario" className="mt-auto block pt-5 text-[13px] font-semibold tracking-tight text-emerald-700 hover:underline">Abrir formulário de suporte</Link>
            </div>
            <div className="flex min-h-[196px] min-w-0 flex-col border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-950 text-sm">SAC</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">Para atendimento ao cliente:</p>
              <a href="mailto:sac@gestao360.org" className="mt-auto block whitespace-nowrap pt-5 text-[13px] font-semibold tracking-tight text-emerald-700 hover:underline">sac@gestao360.org</a>
            </div>
            <div className="flex min-h-[196px] min-w-0 flex-col border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-950 text-sm">Comercial</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">Para contato comercial ou proposta:</p>
              <Link href="/contato" className="mt-auto block pt-5 text-[13px] font-semibold tracking-tight text-emerald-700 hover:underline">Abrir formulário comercial</Link>
            </div>
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
