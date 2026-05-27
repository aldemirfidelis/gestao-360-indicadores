'use client';

import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileBarChart,
  LineChart,
  LockKeyhole,
  Mail,
  Map,
  Menu,
  Network,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#produto', label: 'Produto' },
  { href: '#metodo', label: 'Método' },
  { href: '#governanca', label: 'Governança' },
  { href: '#planos', label: 'Planos' },
  { href: '#contato', label: 'Contato' },
];

const PRODUCT_AREAS = [
  {
    icon: Target,
    title: 'Indicadores e metas',
    desc: 'Cadastre KPIs, metas, tolerâncias, periodicidades e responsáveis por área, processo ou unidade.',
  },
  {
    icon: Map,
    title: 'Mapa estratégico',
    desc: 'Conecte objetivos, perspectivas BSC e relações de causa e efeito em um mapa único.',
  },
  {
    icon: ClipboardList,
    title: 'Planos de ação',
    desc: 'Transforme desvio em ação com prazos, responsáveis, prioridades, anexos e acompanhamento.',
  },
  {
    icon: ClipboardCheck,
    title: 'Análise de causa',
    desc: 'Estruture FCA, 5 porquês, Ishikawa, MASP, PDCA, DMAIC e CAPA com histórico auditável.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard executivo',
    desc: 'Veja atingimento, faróis, riscos por setor e evolução mensal sem depender de planilhas paralelas.',
  },
  {
    icon: Network,
    title: 'Organograma e processos',
    desc: 'Mapeie empresas, unidades, áreas e processos para distribuir responsabilidades com clareza.',
  },
  {
    icon: Users,
    title: 'Reuniões e rotina',
    desc: 'Leve pautas, pendências e decisões para um fluxo recorrente de gestão por resultado.',
  },
  {
    icon: FileBarChart,
    title: 'Relatórios e evidências',
    desc: 'Exporte informações consolidadas para diretoria, qualidade, auditorias e acompanhamento mensal.',
  },
];

const PROCESS_STEPS = [
  {
    label: '1',
    title: 'Defina o modelo de gestão',
    desc: 'Objetivos, áreas, indicadores, metas e papéis ficam padronizados desde a implantação.',
  },
  {
    label: '2',
    title: 'Acompanhe a execução',
    desc: 'Resultados, faróis, atrasos e desvios aparecem no mesmo painel para liderança e operação.',
  },
  {
    label: '3',
    title: 'Trate o desvio com método',
    desc: 'Cada indicador fora da meta pode virar análise de causa, plano de ação e reunião de acompanhamento.',
  },
  {
    label: '4',
    title: 'Comprove evolução',
    desc: 'A trilha de decisões, responsáveis e evidências fica pronta para auditoria e gestão mensal.',
  },
];

const GOVERNANCE_ITEMS = [
  'Perfis de acesso por responsabilidade e área',
  'Histórico de alterações com usuário, data e origem',
  'Fluxo completo do desvio até a eficácia da ação',
  'Evidências e anexos vinculados ao indicador',
  'Exportação para ritos gerenciais e auditorias',
];

const PLANS = [
  {
    name: 'Essencial',
    price: 'R$ 890',
    suffix: '/mês',
    description: 'Para equipes que querem substituir controles dispersos por uma rotina única de indicadores.',
    features: [
      'Até 25 usuários',
      'Indicadores, OKRs e planos de ação',
      'Importação por planilha',
      'Painéis de acompanhamento',
      'Suporte por e-mail',
    ],
    cta: 'Conhecer o Essencial',
    highlighted: false,
  },
  {
    name: 'Profissional',
    price: 'R$ 2.490',
    suffix: '/mês',
    description: 'Para empresas que precisam conectar estratégia, operação e melhoria contínua.',
    features: [
      'Até 150 usuários',
      'Todos os módulos da plataforma',
      'Mapa estratégico e análise de causa',
      'API para integrações',
      'Suporte prioritário',
    ],
    cta: 'Falar com vendas',
    highlighted: true,
  },
  {
    name: 'Corporativo',
    price: 'Sob consulta',
    suffix: '',
    description: 'Para grupos com múltiplas unidades, governança avançada e implantação assistida.',
    features: [
      'Usuários e unidades sob medida',
      'SSO, auditoria avançada e políticas de acesso',
      'Ambiente dedicado ou nuvem privada',
      'SLA e gerente de sucesso',
      'Treinamento e implantação guiada',
    ],
    cta: 'Solicitar proposta',
    highlighted: false,
  },
];

const FAQS = [
  {
    q: 'Em quanto tempo a empresa consegue começar?',
    a: 'A configuração inicial pode ficar pronta em poucos dias quando os cadastros principais já existem. Implantações com histórico, treinamento e desenho de rotina costumam depender do número de áreas, indicadores e integrações.',
  },
  {
    q: 'A plataforma substitui as planilhas de indicadores?',
    a: 'Sim. A ideia é manter metas, resultados, faróis, responsáveis e planos de ação em um ambiente controlado. Planilhas podem ser usadas para importação inicial ou cargas recorrentes quando fizer sentido.',
  },
  {
    q: 'É possível começar apenas com alguns módulos?',
    a: 'Sim. O Gestão 360 foi organizado de forma modular. Muitas empresas começam por indicadores e planos de ação, depois expandem para mapa estratégico, OKRs, reuniões e análise de causa.',
  },
  {
    q: 'Como ficam permissões e auditoria?',
    a: 'Os acessos são definidos por perfil e responsabilidade. Alterações relevantes ficam registradas para facilitar rastreabilidade, prestação de contas e auditorias internas ou externas.',
  },
  {
    q: 'Vocês ajudam na implantação?',
    a: 'Sim. A implantação pode incluir revisão de cadastros, importação, parametrização, treinamento e acompanhamento dos primeiros ciclos de gestão.',
  },
];

const LOGOS = ['Diretoria', 'Qualidade', 'Operações', 'Controladoria', 'RH Estratégico'];

export default function LandingPage() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const ctaHref = user ? '/dashboard' : '/login';
  const ctaLabel = user ? 'Ir para o dashboard' : 'Acessar plataforma';

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center" title="Gestão 360">
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
            <Button asChild>
              <a href="#contato">
                Agendar demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-md p-2 text-slate-700 transition hover:bg-slate-100 md:hidden"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <div className="mx-auto max-w-7xl space-y-1 px-4 py-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {link.label}
                </a>
              ))}
              <div className="grid gap-2 pt-2">
                <Button asChild variant="outline" className="w-full">
                  <Link href={ctaHref}>{ctaLabel}</Link>
                </Button>
                <Button asChild className="w-full">
                  <a href="#contato" onClick={() => setMobileOpen(false)}>
                    Agendar demo
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        <section id="produto" className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:px-8 lg:py-16">
            <div className="flex flex-col justify-center">
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-md border border-teal-200 bg-white px-3 py-1 text-sm font-medium text-teal-800">
                <ShieldCheck className="h-4 w-4" />
                SaaS para rotina de gestão estratégica
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-none text-slate-950 sm:text-5xl lg:text-6xl">
                Gestão 360
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700">
                Centralize indicadores, OKRs, planos de ação e análise de causa em uma plataforma pensada para empresas que
                precisam transformar metas em execução acompanhável.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-11 px-6">
                  <a href="#contato">
                    Solicitar demonstração
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-6">
                  <Link href={ctaHref}>{ctaLabel}</Link>
                </Button>
              </div>

              <div className="mt-9 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
                <TrustItem label="Rastreabilidade" />
                <TrustItem label="Rotina por área" />
                <TrustItem label="Evidências auditáveis" />
              </div>
            </div>

            <ProductPreview />
          </div>

          <div className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
              <p className="text-sm font-medium text-slate-700">Construído para rotinas de gestão que envolvem</p>
              <div className="flex flex-wrap gap-2">
                {LOGOS.map((item) => (
                  <span key={item} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.78fr,1.22fr] lg:items-start">
              <div>
                <p className="text-sm font-semibold text-teal-700">Produto</p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">
                  Uma plataforma para conectar estratégia, operação e melhoria contínua.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  O Gestão 360 organiza a rotina de indicadores com método, responsabilidades e visibilidade executiva. Cada
                  módulo compartilha a mesma base de usuários, áreas, processos e auditoria.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {PRODUCT_AREAS.map((area) => {
                  const Icon = area.icon;
                  return (
                    <article key={area.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-800">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-950">{area.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{area.desc}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="metodo" className="border-y border-slate-200 bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-teal-700">Método</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">
                Da meta ao plano de ação, com responsabilidade clara em cada etapa.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                A plataforma reduz a distância entre planejamento e execução: o resultado mensal mostra o desvio, o desvio
                abre a tratativa, a tratativa gera ação e a ação volta para o acompanhamento de eficácia.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {PROCESS_STEPS.map((step) => (
                <article key={step.title} className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="mb-4 grid h-8 w-8 place-items-center rounded-md bg-teal-700 text-sm font-semibold text-white">
                    {step.label}
                  </div>
                  <h3 className="text-base font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="governanca" className="bg-white py-16 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr,0.9fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold text-teal-700">Governança</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">
                Controle suficiente para diretoria, qualidade e auditoria trabalharem com confiança.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Em vez de relatórios montados manualmente ao fim do mês, cada decisão fica ligada ao indicador, área,
                responsável e evidência que originou a ação.
              </p>

              <div className="mt-8 grid gap-3">
                {GOVERNANCE_ITEMS.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                    <span className="text-sm leading-6 text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm text-slate-300">Trilha de auditoria</p>
                  <h3 className="mt-1 text-lg font-semibold">Tratativa do indicador OEE</h3>
                </div>
                <LockKeyhole className="h-5 w-5 text-teal-300" />
              </div>
              <AuditRow label="Resultado lançado" value="78,4%" status="Registrado" tone="green" />
              <AuditRow label="Desvio identificado" value="-6,6 p.p." status="Crítico" tone="red" />
              <AuditRow label="Causa raiz" value="Setup acima do padrão" status="Validado" tone="amber" />
              <AuditRow label="Plano de ação" value="3 ações abertas" status="Em curso" tone="blue" />
              <div className="mt-5 rounded-md border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Responsável</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Coordenação de Produção</p>
                    <p className="text-xs text-slate-400">Prazo de revisão: 31/05/2026</p>
                  </div>
                  <Factory className="h-5 w-5 text-slate-300" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="planos" className="border-y border-slate-200 bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold text-teal-700">Planos</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">
                Comece com o escopo certo e expanda conforme a maturidade da gestão.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Planos pensados para implantação gradual, com módulos, usuários e suporte alinhados ao tamanho da operação.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <article
                  key={plan.name}
                  className={cn(
                    'flex rounded-lg border bg-white p-6 shadow-sm',
                    plan.highlighted ? 'border-teal-700 ring-1 ring-teal-700' : 'border-slate-200',
                  )}
                >
                  <div className="flex min-h-full w-full flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{plan.name}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{plan.description}</p>
                      </div>
                      {plan.highlighted && (
                        <span className="shrink-0 rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                          Recomendado
                        </span>
                      )}
                    </div>

                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold text-slate-950">{plan.price}</span>
                      {plan.suffix && <span className="text-sm text-slate-500">{plan.suffix}</span>}
                    </div>

                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                          <Check className="mt-1 h-4 w-4 shrink-0 text-teal-700" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      className={cn('mt-7 w-full', !plan.highlighted && 'bg-slate-900 hover:bg-slate-800')}
                      variant={plan.highlighted ? 'default' : undefined}
                    >
                      <a href="#contato">{plan.cta}</a>
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              Valores referenciais para assinatura mensal. Implantação, integrações e ambientes dedicados são definidos conforme
              escopo.
            </p>
          </div>
        </section>

        <section id="faq" className="bg-white py-16 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.75fr,1.25fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold text-teal-700">Perguntas frequentes</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">
                Antes de levar a proposta para o time.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Respostas diretas para as dúvidas que costumam aparecer em avaliações comerciais e implantação.
              </p>
            </div>

            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {FAQS.map((faq, idx) => {
                const open = openFaq === idx;
                return (
                  <button
                    key={faq.q}
                    onClick={() => setOpenFaq(open ? null : idx)}
                    className="block w-full px-5 py-5 text-left transition-colors hover:bg-slate-50"
                    aria-expanded={open}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-base font-semibold text-slate-950">{faq.q}</span>
                      <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
                    </div>
                    {open && <p className="mt-3 text-sm leading-6 text-slate-600">{faq.a}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section id="contato" className="border-t border-slate-200 bg-slate-950 py-16 text-white lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr,1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold text-teal-300">Contato comercial</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">
                Veja o Gestão 360 aplicado à rotina da sua empresa.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Em uma conversa objetiva, entendemos seu cenário de indicadores, demonstramos os fluxos principais e indicamos
                o melhor caminho de implantação.
              </p>

              <div className="mt-8 grid gap-4">
                <ContactPoint icon={<LineChart className="h-5 w-5" />} title="Demonstração guiada" desc="Fluxo de indicadores, desvios, ações e relatórios." />
                <ContactPoint icon={<ShieldCheck className="h-5 w-5" />} title="Diagnóstico de implantação" desc="Escopo, cadastros, integrações e rotina gerencial." />
                <ContactPoint icon={<Mail className="h-5 w-5" />} title="Retorno comercial" desc="Resposta em até 1 dia útil após o envio." />
              </div>
            </div>

            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <BrandLogo />
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
                Plataforma corporativa para gestão estratégica, indicadores, planos de ação e melhoria contínua.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 text-sm">
              <div>
                <h3 className="font-semibold text-slate-950">Produto</h3>
                <ul className="mt-3 space-y-2 text-slate-600">
                  <li>
                    <a href="#produto" className="hover:text-slate-950">Visão geral</a>
                  </li>
                  <li>
                    <a href="#metodo" className="hover:text-slate-950">Método</a>
                  </li>
                  <li>
                    <a href="#planos" className="hover:text-slate-950">Planos</a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-950">Empresa</h3>
                <ul className="mt-3 space-y-2 text-slate-600">
                  <li>
                    <a href="#contato" className="hover:text-slate-950">Contato</a>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-slate-950">Área do cliente</Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Gestão 360. Todos os direitos reservados.</span>
            <span>Criado e desenvolvido por Aldemir Fidelis.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TrustItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
      <span>{label}</span>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative lg:pt-3">
      <div className="rounded-lg border border-slate-300 bg-white p-3 shadow-xl">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-xs font-medium text-slate-500">Dashboard executivo</div>
              <div className="text-sm font-semibold text-slate-950">Maio/2026 · Operações</div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <StatusDot tone="green" label="No prazo" />
              <StatusDot tone="amber" label="Atenção" />
              <StatusDot tone="red" label="Crítico" />
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3">
            <PreviewMetric label="Atingimento geral" value="86%" tone="green" />
            <PreviewMetric label="Ações atrasadas" value="7" tone="amber" />
            <PreviewMetric label="Indicadores críticos" value="12" tone="red" />
          </div>

          <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[0.9fr,1.1fr]">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Evolução mensal</p>
                  <p className="text-sm font-semibold text-slate-950">Indicadores dentro da meta</p>
                </div>
                <TrendingUp className="h-4 w-4 text-teal-700" />
              </div>
              <div className="flex h-36 items-end gap-2">
                {[54, 62, 58, 71, 69, 78, 82, 86].map((height, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full rounded-sm bg-teal-700" style={{ height: `${height}%` }} />
                    <span className="text-[10px] text-slate-400">{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Tratativas prioritárias</p>
                  <p className="text-sm font-semibold text-slate-950">Risco por processo</p>
                </div>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <PreviewRow area="Produção" indicator="OEE linha 03" status="Causa em análise" tone="red" />
              <PreviewRow area="Logística" indicator="OTIF clientes A" status="Plano aberto" tone="amber" />
              <PreviewRow area="Qualidade" indicator="Reclamações" status="Em eficácia" tone="green" />
              <PreviewRow area="Manutenção" indicator="MTTR crítico" status="Reunião marcada" tone="amber" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'red' }) {
  const toneClass = {
    green: 'text-teal-800 bg-teal-50 border-teal-200',
    amber: 'text-amber-800 bg-amber-50 border-amber-200',
    red: 'text-red-800 bg-red-50 border-red-200',
  }[tone];

  return (
    <div className={cn('rounded-md border p-4', toneClass)}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function PreviewRow({
  area,
  indicator,
  status,
  tone,
}: {
  area: string;
  indicator: string;
  status: string;
  tone: 'green' | 'amber' | 'red';
}) {
  const toneClass = {
    green: 'bg-teal-600',
    amber: 'bg-amber-500',
    red: 'bg-red-600',
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{indicator}</p>
        <p className="text-xs text-slate-500">{area}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-slate-600">
        <span className={cn('h-2.5 w-2.5 rounded-full', toneClass)} aria-hidden="true" />
        <span className="hidden sm:inline">{status}</span>
      </div>
    </div>
  );
}

function StatusDot({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' }) {
  const toneClass = {
    green: 'bg-teal-600',
    amber: 'bg-amber-500',
    red: 'bg-red-600',
  }[tone];

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600">
      <span className={cn('h-2.5 w-2.5 rounded-full', toneClass)} aria-hidden="true" />
      {label}
    </div>
  );
}

function AuditRow({
  label,
  value,
  status,
  tone,
}: {
  label: string;
  value: string;
  status: string;
  tone: 'green' | 'amber' | 'red' | 'blue';
}) {
  const toneClass = {
    green: 'bg-teal-400/15 text-teal-200',
    amber: 'bg-amber-400/15 text-amber-200',
    red: 'bg-red-400/15 text-red-200',
    blue: 'bg-sky-400/15 text-sky-200',
  }[tone];

  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs text-slate-400">{value}</p>
      </div>
      <span className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs font-medium', toneClass)}>{status}</span>
    </div>
  );
}

function ContactPoint({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/10 text-teal-300">{icon}</div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const summary = useMemo(() => {
    const company = formData.company ? ` da ${formData.company}` : '';
    return `Obrigado${company}. Recebemos sua solicitação e retornaremos em até 1 dia útil.`;
  }, [formData.company]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setFormData(Object.fromEntries(data.entries()) as Record<string, string>);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-white/10 bg-white p-7 text-slate-950 shadow-xl">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-teal-50 text-teal-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-xl font-semibold">Solicitação enviada</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p>
        <Button className="mt-6" onClick={() => setSubmitted(false)} variant="outline">
          Enviar outra solicitação
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-white/10 bg-white p-6 text-slate-950 shadow-xl">
      <h3 className="text-xl font-semibold">Solicitar demonstração</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Preencha os dados para receber uma proposta de conversa comercial.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" required />
        <Field label="E-mail profissional" name="email" type="email" required />
        <Field label="Empresa" name="company" required />
        <Field label="Telefone" name="phone" type="tel" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-700" htmlFor="team-size">
            Tamanho da equipe
          </label>
          <select
            id="team-size"
            name="teamSize"
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
          >
            <option>Até 25 usuários</option>
            <option>26 a 150 usuários</option>
            <option>Mais de 150 usuários</option>
            <option>Ainda não sei</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700" htmlFor="interest">
            Interesse principal
          </label>
          <select
            id="interest"
            name="interest"
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
          >
            <option>Indicadores e metas</option>
            <option>Planos de ação</option>
            <option>Mapa estratégico</option>
            <option>Implantação completa</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-700" htmlFor="message">
          Contexto
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
          placeholder="Conte sobre sua rotina atual de indicadores, áreas envolvidas ou prazo de implantação."
        />
      </div>

      <Button type="submit" size="lg" className="mt-5 w-full">
        Enviar solicitação
      </Button>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Usaremos seus dados apenas para responder ao contato comercial solicitado.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700" htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        required={required}
        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
      />
    </div>
  );
}
