'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Crosshair,
  FolderKanban,
  LineChart,
  Map,
  Menu,
  Network,
  Shield,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#modulos', label: 'Módulos' },
  { href: '#beneficios', label: 'Benefícios' },
  { href: '#precos', label: 'Preços' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contato', label: 'Contato' },
];

const MODULES = [
  {
    icon: Target,
    title: 'Indicadores',
    desc: 'Farol em tempo real, ranking de aderência, histórico mensal e drill-down até a causa raiz.',
    accent: 'from-sky-500 to-blue-600',
  },
  {
    icon: Map,
    title: 'Mapa Estratégico',
    desc: 'Perspectivas BSC, objetivos, relações de causa e efeito visuais e ligadas aos indicadores.',
    accent: 'from-violet-500 to-purple-600',
  },
  {
    icon: Crosshair,
    title: 'OKRs',
    desc: 'Objetivos e Key Results com cadência trimestral, contribuintes e cálculo automático de progresso.',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    icon: ClipboardList,
    title: 'Planos de Ação',
    desc: 'Origem rastreável (indicador, desvio, reunião), responsáveis, prazos, anexos e eficácia pós-fechamento.',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    icon: ClipboardCheck,
    title: 'Análise de Causa',
    desc: 'FCA, 5 porquês, Ishikawa, MASP, PDCA, DMAIC e CAPA — fluxo guiado e auditável de tratativas.',
    accent: 'from-rose-500 to-red-600',
  },
  {
    icon: Network,
    title: 'Organograma',
    desc: 'Estrutura corporativa de empresas, unidades, áreas e processos com propagação de responsabilidades.',
    accent: 'from-indigo-500 to-blue-700',
  },
  {
    icon: FolderKanban,
    title: 'Projetos & Cronogramas',
    desc: 'Gantt, marcos, dependências e vínculo com indicadores e objetivos estratégicos.',
    accent: 'from-cyan-500 to-sky-600',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Executivo',
    desc: 'Visão 360 para decisão: KPIs, alertas críticos, setores em risco e tendências consolidadas.',
    accent: 'from-fuchsia-500 to-pink-600',
  },
];

const BENEFITS = [
  {
    icon: Zap,
    title: 'Tudo num só lugar',
    desc: 'Estratégia, indicadores, OKRs, ações e reuniões integrados — chega de planilhas isoladas e retrabalho.',
  },
  {
    icon: LineChart,
    title: 'Decisão por dados',
    desc: 'Farol automático, atingimento e desvios calculados em tempo real. O time discute fato, não opinião.',
  },
  {
    icon: Shield,
    title: 'Pronto para auditoria',
    desc: 'Trilha de auditoria completa, controle de acesso granular por perfil e LGPD por design.',
  },
  {
    icon: Sparkles,
    title: 'Implantação rápida',
    desc: 'Onboarding guiado, importação por planilha, modelos prontos por setor e suporte na configuração inicial.',
  },
  {
    icon: Users,
    title: 'Engaja o time',
    desc: 'Notificações, atribuições e visão por área garantem que cada um saiba o que fazer e quando.',
  },
  {
    icon: CheckCircle2,
    title: 'Melhoria contínua',
    desc: 'Do desvio à eficácia da ação — ciclos PDCA fechados com indicadores de retrabalho e reincidência.',
  },
];

const PLANS = [
  {
    name: 'Essencial',
    price: 'R$ 890',
    suffix: '/mês',
    description: 'Para times que estão estruturando a gestão por indicadores.',
    features: [
      'Até 25 usuários',
      'Indicadores, OKRs e Planos de Ação',
      'Importação por planilha',
      'Suporte por e-mail',
      '2 GB de anexos',
    ],
    cta: 'Quero conhecer',
    highlighted: false,
  },
  {
    name: 'Profissional',
    price: 'R$ 2.490',
    suffix: '/mês',
    description: 'Para empresas que querem rodar a estratégia ponta a ponta.',
    features: [
      'Até 150 usuários',
      'Todos os módulos da plataforma',
      'Mapa Estratégico e Análise de Causa',
      'API e integrações',
      'Suporte prioritário',
      '50 GB de anexos',
    ],
    cta: 'Falar com vendas',
    highlighted: true,
  },
  {
    name: 'Corporativo',
    price: 'Sob consulta',
    suffix: '',
    description: 'Para grupos com múltiplas unidades, BUs e exigências regulatórias.',
    features: [
      'Usuários ilimitados',
      'SSO / SAML, auditoria avançada',
      'Multi-empresa e multi-idioma',
      'SLA e gerente de sucesso dedicado',
      'On-premise ou nuvem privada',
      'Treinamento e implantação assistida',
    ],
    cta: 'Solicitar proposta',
    highlighted: false,
  },
];

const FAQS = [
  {
    q: 'Quanto tempo leva para implantar?',
    a: 'A configuração básica fica pronta em até 5 dias úteis. Para implantações guiadas (modelos, importação histórica e treinamento) o prazo típico é de 3 a 6 semanas, dependendo do porte da operação.',
  },
  {
    q: 'Posso importar dados das minhas planilhas atuais?',
    a: 'Sim. A plataforma aceita importação por planilha (XLSX/CSV) para indicadores, metas, resultados, áreas e usuários. Também oferecemos API para integrações nativas com seus sistemas (ERP, BI, RH).',
  },
  {
    q: 'A solução atende LGPD e auditorias externas?',
    a: 'Sim. Toda alteração é registrada em trilha de auditoria (quem, quando, o quê) e os perfis de acesso seguem o princípio do menor privilégio. Exportamos relatórios e evidências sob demanda.',
  },
  {
    q: 'É possível personalizar fórmulas e periodicidades?',
    a: 'Sim. Cada indicador suporta unidades, fórmulas, sentido (maior/menor melhor), tolerância de farol e periodicidade própria (diária, mensal, trimestral, anual ou customizada).',
  },
  {
    q: 'Como funciona o suporte?',
    a: 'Planos Essencial e Profissional contam com suporte por e-mail e portal. Corporativo inclui gerente de sucesso, SLA com horário estendido e canal direto via WhatsApp/Teams.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim, a assinatura é mensal. Para o plano Corporativo, oferecemos descontos significativos em contratos anuais.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const ctaHref = user ? '/dashboard' : '/login';
  const ctaLabel = user ? 'Ir para o Dashboard' : 'Acessar plataforma';

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center" title="Gestão 360">
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#contato"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Contate-nos
            </a>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          </div>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-md p-2 md:hidden"
            aria-label="Menu"
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
              <Button asChild className="mt-2 w-full bg-blue-600 hover:bg-blue-700">
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-blue-50" />
        <div
          className="absolute -top-32 left-1/2 -z-10 h-[460px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-cyan-200/40 via-blue-300/30 to-violet-300/30 blur-3xl"
          aria-hidden
        />

        <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8 lg:pt-28 lg:pb-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma all-in-one de gestão estratégica
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              A plataforma que conecta <span className="bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 bg-clip-text text-transparent">estratégia, indicadores e ação</span> da sua empresa
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 sm:text-lg">
              Centralize objetivos, KPIs, OKRs, planos de ação e melhoria contínua em um único sistema feito para
              executivos, gerentes e times operacionais. Decisões mais rápidas, com auditabilidade ponta a ponta.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 bg-blue-600 px-7 text-base hover:bg-blue-700">
                <a href="#contato">
                  Agende uma demonstração
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-slate-300 px-7 text-base">
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Implantação em até 5 dias
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                LGPD e trilha de auditoria
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Sem cobrança por usuário ocioso
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section id="modulos" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Módulos</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Uma suíte completa, modular e integrada
            </h2>
            <p className="mt-4 text-base text-slate-600">
              Você ativa apenas o que precisa. Todos os módulos compartilham os mesmos cadastros, perfis e trilhas de auditoria.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.title}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                      mod.accent,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{mod.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{mod.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="relative overflow-hidden bg-slate-50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Por que Gestão 360</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Os resultados que sua liderança quer ver
            </h2>
            <p className="mt-4 text-base text-slate-600">
              Mais do que ferramentas: um método estruturado para transformar planejamento em execução medida.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Métricas */}
          <div className="mt-16 grid grid-cols-2 gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:grid-cols-4">
            {[
              { v: '+200', l: 'indicadores por cliente em média' },
              { v: '5 dias', l: 'para implantação básica' },
              { v: '99,9%', l: 'de disponibilidade SLA' },
              { v: '24/7', l: 'monitoramento de infraestrutura' },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
                  {s.v}
                </div>
                <div className="mt-1 text-xs text-slate-600 sm:text-sm">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Planos</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Escolha o plano que cresce com a sua operação
            </h2>
            <p className="mt-4 text-base text-slate-600">
              Comece pequeno e expanda conforme o ritmo da empresa. Sem fidelidade, sem surpresas.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-white p-7 shadow-sm transition-all',
                  plan.highlighted
                    ? 'border-blue-600 shadow-xl ring-1 ring-blue-600/20 lg:-translate-y-2'
                    : 'border-slate-200 hover:shadow-md',
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                    Mais escolhido
                  </div>
                )}
                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900">{plan.price}</span>
                  {plan.suffix && <span className="text-sm text-slate-500">{plan.suffix}</span>}
                </div>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={cn(
                    'mt-7 w-full',
                    plan.highlighted ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800',
                  )}
                >
                  <a href="#contato">{plan.cta}</a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Perguntas frequentes</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tire suas dúvidas antes de começar
            </h2>
          </div>

          <div className="mt-12 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {FAQS.map((faq, idx) => {
              const open = openFaq === idx;
              return (
                <button
                  key={faq.q}
                  onClick={() => setOpenFaq(open ? null : idx)}
                  className="block w-full px-6 py-5 text-left transition-colors hover:bg-slate-50"
                  aria-expanded={open}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-900 sm:text-base">{faq.q}</span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 shrink-0 text-slate-500 transition-transform',
                        open && 'rotate-180 text-blue-600',
                      )}
                    />
                  </div>
                  {open && <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.a}</p>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="relative overflow-hidden bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-900 to-violet-900 px-6 py-12 shadow-xl sm:px-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:px-14 lg:py-16">
            <div className="text-white">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Pronto para colocar sua estratégia em movimento?
              </h2>
              <p className="mt-4 text-base text-slate-200">
                Fale com nosso time. Em uma reunião de 30 minutos mostramos a plataforma rodando com cenários do seu setor e
                construímos juntos uma proposta personalizada.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-slate-200">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  Demo personalizada com seus dados de exemplo
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  Proposta com prazo de implantação realista
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  Suporte do início ao fim — sem custo na avaliação
                </li>
              </ul>
            </div>

            <ContactForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <BrandLogo />
              <p className="mt-4 max-w-md text-sm text-slate-600">
                Plataforma corporativa de gestão estratégica, indicadores, planos de ação e melhoria contínua.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Produto</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li><a href="#modulos" className="hover:text-slate-900">Módulos</a></li>
                <li><a href="#beneficios" className="hover:text-slate-900">Benefícios</a></li>
                <li><a href="#precos" className="hover:text-slate-900">Preços</a></li>
                <li><a href="#faq" className="hover:text-slate-900">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Empresa</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li><a href="#contato" className="hover:text-slate-900">Contato</a></li>
                <li><Link href="/login" className="hover:text-slate-900">Área do cliente</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Gestão 360. Todos os direitos reservados.</span>
            <span>Criado e Desenvolvido por Aldemir Fidelis</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-10 flex h-full flex-col items-center justify-center rounded-2xl bg-white/10 p-8 text-center text-white backdrop-blur lg:mt-0">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle2 className="h-7 w-7 text-emerald-300" />
        </div>
        <h3 className="text-xl font-semibold">Obrigado pelo contato!</h3>
        <p className="mt-2 max-w-sm text-sm text-slate-200">
          Recebemos seu interesse. Nosso time comercial responderá em até 1 dia útil.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-10 rounded-2xl bg-white p-6 shadow-lg lg:mt-0"
    >
      <h3 className="text-lg font-semibold text-slate-900">Fale com o time comercial</h3>
      <p className="mt-1 text-sm text-slate-500">Resposta em até 1 dia útil.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome completo" name="name" required />
        <Field label="E-mail corporativo" name="email" type="email" required />
        <Field label="Empresa" name="company" required />
        <Field label="Telefone" name="phone" type="tel" />
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-700">Como podemos ajudar?</label>
        <textarea
          name="message"
          rows={4}
          required
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Conte um pouco sobre seu cenário, número de usuários, prazos, etc."
        />
      </div>

      <Button type="submit" size="lg" className="mt-5 w-full bg-blue-600 text-base hover:bg-blue-700">
        Enviar mensagem
      </Button>
      <p className="mt-3 text-[11px] text-slate-500">
        Ao enviar, você concorda com nossa política de privacidade. Não compartilhamos seus dados.
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
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}
