'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ClipboardCheck,
  Database,
  FileText,
  GitBranch,
  ListChecks,
  Map,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#modulos', label: 'Modulos' },
  { href: '#conexoes', label: 'Conexoes' },
  { href: '#governanca', label: 'Governanca' },
  { href: '#planos', label: 'Planos' },
];

const METRICS = [
  { label: 'Modulos conectados', value: '12+' },
  { label: 'Fluxos auditaveis', value: '100%' },
  { label: 'Controle por empresa', value: 'Global' },
  { label: 'Demo pronta', value: 'Agora' },
];

const MODULES = [
  {
    icon: Target,
    title: 'Indicadores e metas',
    desc: 'KPIs, metas, farois, tolerancias, responsaveis, periodicidade e historico de resultados.',
  },
  {
    icon: Map,
    title: 'Estrategia e BSC',
    desc: 'Mapas estrategicos, perspectivas, objetivos e conexao entre estrategia e rotina operacional.',
  },
  {
    icon: ListChecks,
    title: 'Planos de acao',
    desc: 'Acoes, tarefas, evidencias, eficacia, aprovacao e acompanhamento por prazo e responsavel.',
  },
  {
    icon: ClipboardCheck,
    title: 'Desvios, NC e causa raiz',
    desc: 'FCA, 5 porques, Ishikawa, MASP, CAPA, DMAIC e trilha ate a solucao validada.',
  },
  {
    icon: FileText,
    title: 'Documentos e formularios',
    desc: 'Controle documental, revisoes, formularios, coletas, aprovacoes e evidencias anexadas.',
  },
  {
    icon: Network,
    title: 'Areas, processos e organograma',
    desc: 'Estrutura por empresa, unidade, area, processo, responsavel e regra de visibilidade.',
  },
  {
    icon: BarChart3,
    title: 'Dashboards executivos',
    desc: 'Visao de performance, atrasos, riscos, desvios, plano de acao e tendencia mensal.',
  },
  {
    icon: ShieldCheck,
    title: 'Auditoria e permissoes',
    desc: 'Perfis, permissoes, escopo por area, logs de alteracao e rastreabilidade por usuario.',
  },
  {
    icon: Boxes,
    title: 'Administracao central',
    desc: 'Planos, modulos por empresa, bloqueios, limites, banco de dados e parametros do contrato.',
  },
];

const CONNECTIONS = [
  { title: 'Estrutura da empresa', desc: 'Empresas, filiais, areas, setores, processos e responsaveis.' },
  { title: 'Acesso e visibilidade', desc: 'Usuarios, perfis, permissoes, matriz de area e excecoes.' },
  { title: 'Gestao de resultado', desc: 'Indicadores, metas, OKRs, dashboards, reunioes e relatorios.' },
  { title: 'Tratativa de desvio', desc: 'Analise de causa, planos de acao, evidencias, NC e eficacia.' },
  { title: 'Governanca do portal', desc: 'Planos, modulos, paginas, menus, integracoes, banco e auditoria.' },
];

const BEST_FEATURES = [
  'Controle de modulos por empresa: libere Modulo X e Y para uma cliente e bloqueie o restante.',
  'Planos claros e customizaveis: usuarios, limites, modulos incluidos e opcionais.',
  'Banco de dados administravel pela equipe autorizada com tabelas, registros, SQL, backup e diagnostico.',
  'Rastreabilidade ponta a ponta: quem alterou, quando, em qual modulo e qual dado foi afetado.',
  'Conectores internos e APIs externas para integrar indicadores, documentos, IA, e-mail e rotinas de apoio.',
  'Permissoes por area para empresas controlarem seus usuarios sem acessar configuracoes globais.',
];

const PLANS = [
  {
    name: 'Essencial',
    users: 'Ate 25 usuarios',
    fit: 'Para empresas que querem sair das planilhas e padronizar a rotina de indicadores.',
    details: [
      'Indicadores, metas, resultados e farois',
      'Planos de acao e evidencias',
      'Usuarios da propria empresa',
      'Dashboards operacionais',
      'Importacao por planilha',
      'Permissoes basicas por perfil',
    ],
  },
  {
    name: 'Profissional',
    users: 'Ate 150 usuarios',
    fit: 'Para operacoes que precisam conectar estrategia, areas, desvios e melhoria continua.',
    details: [
      'Tudo do Essencial',
      'Mapa estrategico, OKRs e reunioes',
      'Analise de causa e nao conformidades',
      'Matriz de visibilidade por area',
      'APIs externas e conectores internos',
      'Auditoria e relatorios completos',
    ],
    highlighted: true,
  },
  {
    name: 'Corporativo',
    users: 'Usuarios sob medida',
    fit: 'Para grupos com multiplas unidades, governanca avancada e necessidade de suporte dedicado.',
    details: [
      'Tudo do Profissional',
      'Modulos por empresa e unidade',
      'Limites customizados de usuarios e dados',
      'Ambientes, snapshots e manutencao',
      'Politicas avancadas de acesso',
      'Implantacao assistida',
    ],
  },
  {
    name: 'Personalizado',
    users: 'Modelo flexivel',
    fit: 'Para cenarios com regras especificas, modulos dedicados, integracoes e operacao assistida.',
    details: [
      'Composicao de modulos sob demanda',
      'Usuarios, unidades e limites customizados',
      'Integrações planejadas com sistemas internos',
      'Administracao central configurada para o contrato',
      'Acompanhamento tecnico de implantacao',
      'Roadmap por prioridade do cliente',
    ],
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const accessHref = user ? '/dashboard' : '/login';
  const accessLabel = user ? 'Ir para dashboard' : 'Acessar demo agora';

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center" title="Gestao 360">
            <BrandLogo />
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link href={accessHref}>
                {accessLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-[#101820] text-white">
          <div className="mx-auto grid min-h-[720px] max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:items-center lg:px-8 lg:py-20">
            <div className="min-w-0">
              <div className="mb-5 inline-flex items-center gap-2 border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                Plataforma completa de gestao por indicadores
              </div>
              <h1 className="text-5xl font-semibold leading-none sm:text-6xl lg:text-7xl">
                Gestao 360
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                Conecte estrategia, indicadores, metas, desvios, planos de acao, auditoria, documentos e processos em um unico ambiente operacional.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 bg-emerald-500 px-7 text-base text-slate-950 hover:bg-emerald-400">
                  <Link href={accessHref}>
                    Acessar demo agora
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-white/40 bg-white/10 px-7 text-base text-white hover:bg-white hover:text-slate-950">
                  <a href="#planos">Ver planos e modulos</a>
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {METRICS.map((metric) => (
                  <div key={metric.label} className="border border-white/15 bg-white/10 p-4">
                    <div className="text-2xl font-semibold">{metric.value}</div>
                    <div className="mt-1 text-sm text-slate-300">{metric.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <HeroDashboard />
          </div>
        </section>

        <section id="modulos" className="py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Modulos"
              title="Tudo que a operacao precisa, trabalhando na mesma base."
              desc="A plataforma nao e apenas um painel. Cada modulo conversa com usuarios, areas, indicadores, evidencias, permissoes e auditoria."
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {MODULES.map((module) => (
                <ModuleCard key={module.title} icon={<module.icon className="h-5 w-5" />} title={module.title} desc={module.desc} />
              ))}
            </div>
          </div>
        </section>

        <section id="conexoes" className="border-y border-slate-200 bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr,1.15fr] lg:px-8">
            <div>
              <SectionIntro
                eyebrow="Conexoes"
                title="O melhor da plataforma esta na ligacao entre os modulos."
                desc="Um resultado fora da meta pode abrir desvio, gerar analise de causa, criar plano de acao, receber evidencias, aparecer no dashboard e ficar auditado."
                compact
              />
              <div className="mt-8 grid gap-3">
                {BEST_FEATURES.map((item) => (
                  <div key={item} className="flex items-start gap-3 border border-slate-200 bg-white p-4">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                    <span className="text-sm leading-6 text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-4 text-sm font-semibold">
                <GitBranch className="h-4 w-4 text-emerald-700" />
                Fluxo conectado
              </div>
              <div className="mt-5 space-y-4">
                {CONNECTIONS.map((item, index) => (
                  <div key={item.title} className="grid grid-cols-[42px,1fr] gap-4">
                    <div className="relative">
                      <div className="grid h-9 w-9 place-items-center border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800">
                        {index + 1}
                      </div>
                      {index < CONNECTIONS.length - 1 && <div className="absolute left-[18px] top-10 h-8 w-px bg-slate-200" />}
                    </div>
                    <div className="pb-2">
                      <h3 className="font-semibold text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="governanca" className="py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Governanca"
              title="Administracao clara para empresas e para o dono da plataforma."
              desc="As empresas ficam com controle dos proprios usuarios. A administracao central cuida de planos, modulos, banco de dados, integracoes, menus, auditoria, parametros e suporte."
            />
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <GovernanceBlock icon={<Users className="h-5 w-5" />} title="Empresa cliente" desc="Cria e administra usuarios da propria empresa, respeitando permissoes e visibilidade por area." />
              <GovernanceBlock icon={<Boxes className="h-5 w-5" />} title="Administracao central" desc="Gerencia planos, modulos liberados, status da empresa, limites, paginas, menus e integracoes." />
              <GovernanceBlock icon={<Database className="h-5 w-5" />} title="Banco de dados" desc="Acesso administrativo a tabelas, registros, SQL, estrutura, indices, importacao, backups e diagnosticos." />
            </div>
          </div>
        </section>

        <section id="planos" className="border-y border-slate-200 bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Planos"
              title="Planos sem pegadinha: modulos, usuarios e limites ficam claros."
              desc="Os valores foram retirados da landing. O foco aqui e mostrar o escopo de cada plano e facilitar a comparacao."
              center
            />
            <div className="mt-10 grid gap-5 lg:grid-cols-4">
              {PLANS.map((plan) => (
                <PlanCard key={plan.name} plan={plan} />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#101820] py-16 text-white lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr,auto] lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-semibold text-emerald-300">Demo pronta para teste</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight">
                Entre agora e veja indicadores, planos de acao, auditoria, documentos e processos funcionando juntos.
              </h2>
              <p className="mt-4 text-slate-300">A demo abre com o formulario de acesso ja preparado para teste.</p>
            </div>
            <Button asChild size="lg" className="h-12 bg-emerald-500 px-7 text-base text-slate-950 hover:bg-emerald-400">
              <Link href={accessHref}>
                Acessar demo agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <BrandLogo />
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Gestao 360 conecta estrategia, execucao, melhoria continua e administracao global em uma plataforma modular.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="border border-slate-200 px-3 py-2 text-slate-700 hover:border-slate-400">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroDashboard() {
  return (
    <div className="min-w-0 border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-sm font-semibold text-white">Painel executivo</div>
          <div className="mt-1 text-xs text-slate-400">Indicadores, acoes e auditoria conectados</div>
        </div>
        <span className="border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-200">Online</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-4">
          <ScenePanel title="Performance por area">
            <div className="space-y-3">
              {[
                ['Operacao', '91%', 'bg-emerald-400'],
                ['Qualidade', '84%', 'bg-sky-400'],
                ['Manutencao', '72%', 'bg-amber-400'],
                ['Seguranca', '67%', 'bg-rose-400'],
              ].map(([label, value, color]) => (
                <div key={label} className="grid grid-cols-[94px,1fr,42px] items-center gap-3 text-xs">
                  <span className="text-slate-300">{label}</span>
                  <span className="h-2 bg-white/10">
                    <span className={cn('block h-2', color)} style={{ width: value }} />
                  </span>
                  <span className="text-right text-white">{value}</span>
                </div>
              ))}
            </div>
          </ScenePanel>
          <ScenePanel title="Planos de acao">
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <SceneMetric label="Abertos" value="38" tone="text-amber-300" />
              <SceneMetric label="No prazo" value="81%" tone="text-emerald-300" />
              <SceneMetric label="Criticos" value="6" tone="text-rose-300" />
            </div>
          </ScenePanel>
        </div>
        <div className="space-y-4">
          <ScenePanel title="Modulos ativos">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {['Indicadores', 'OKRs', 'Auditoria', 'Documentos', 'Riscos', 'Formularios'].map((item) => (
                <span key={item} className="border border-white/10 bg-white/5 px-2 py-2 text-slate-200">{item}</span>
              ))}
            </div>
          </ScenePanel>
          <ScenePanel title="Auditoria">
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between gap-3"><span>LOGIN</span><span className="text-emerald-300">SUCCESS</span></div>
              <div className="flex justify-between gap-3"><span>RESULT_UPDATE</span><span className="text-sky-300">SYNC</span></div>
              <div className="flex justify-between gap-3"><span>BACKUP</span><span className="text-emerald-300">OK</span></div>
            </div>
          </ScenePanel>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center text-xs sm:grid-cols-4">
        <SceneMetric label="Usuarios" value="148" tone="text-white" />
        <SceneMetric label="Indicadores" value="420" tone="text-white" />
        <SceneMetric label="Acoes" value="1.2k" tone="text-white" />
        <SceneMetric label="Logs" value="24k" tone="text-white" />
      </div>
    </div>
  );
}

function ScenePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-white/10 bg-[#16232d]/90 p-4">
      <div className="mb-4 flex items-center justify-between text-xs font-semibold text-white">
        <span>{title}</span>
        <span className="h-2 w-2 bg-emerald-300" />
      </div>
      {children}
    </div>
  );
}

function SceneMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="border border-white/10 bg-white/5 p-3">
      <div className={cn('text-lg font-semibold', tone)}>{value}</div>
      <div className="mt-1 text-slate-400">{label}</div>
    </div>
  );
}

function SectionIntro({ eyebrow, title, desc, center, compact }: { eyebrow: string; title: string; desc: string; center?: boolean; compact?: boolean }) {
  return (
    <div className={cn(center && 'mx-auto text-center', compact ? 'max-w-xl' : 'max-w-3xl')}>
      <p className="text-sm font-semibold text-emerald-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-600">{desc}</p>
    </div>
  );
}

function ModuleCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <article className="border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center bg-slate-100 text-slate-800">{icon}</div>
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
        </div>
      </div>
    </article>
  );
}

function GovernanceBlock({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <article className="border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid h-11 w-11 place-items-center bg-slate-100 text-slate-800">{icon}</div>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{desc}</p>
    </article>
  );
}

function PlanCard({ plan }: { plan: (typeof PLANS)[number] }) {
  return (
    <article className={cn('flex border bg-white p-5 shadow-sm', plan.highlighted ? 'border-emerald-700 ring-1 ring-emerald-700' : 'border-slate-200')}>
      <div className="flex min-h-full w-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">{plan.name}</h3>
            <p className="mt-2 text-sm font-medium text-emerald-700">{plan.users}</p>
          </div>
          {plan.highlighted && <span className="bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Mais completo</span>}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">{plan.fit}</p>
        <ul className="mt-5 flex-1 space-y-3">
          {plan.details.map((detail) => (
            <li key={detail} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
              <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
        <Button asChild className={cn('mt-6 w-full', plan.highlighted ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800')}>
          <Link href="/login">Testar na demo</Link>
        </Button>
      </div>
    </article>
  );
}
