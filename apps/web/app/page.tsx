import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BarChart3, CheckSquare, ListTodo, Target, Trophy } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { DemoLink } from '@/components/marketing/demo-link';
import { JsonLd } from '@/components/marketing/json-ld';
import { publicMetadata, organizationJsonLd, websiteJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({ title: 'Gestão 360 | BSC, indicadores e resultados', description: 'Conecte a estratégia aos resultados com BSC, indicadores, planos de ação e gestão de prêmio. Explore uma demonstração com dados preenchidos.', path: '/' });
const modules = [
  { title: 'Meu Dia', icon: ListTodo, text: 'Prioridades, prazos e indicadores que precisam da sua atenção em um só lugar.' },
  { title: 'Tarefas', icon: CheckSquare, text: 'Transforme compromissos em execução, com responsáveis, checklists e acompanhamento.' },
  { title: 'Gestão à Vista', icon: BarChart3, text: 'BSC, indicadores, metas, resultados, desvios, planos de ação, reuniões e OKRs conectados.' },
  { title: 'Gestão de Prêmio', icon: Trophy, text: 'Programas, regras, competências, apuração e demonstrativos vinculados aos resultados.' },
];
export default function Home() {
  return <PublicShell>
    <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
    <section className="relative overflow-hidden bg-[#081023] text-white">
      <div className="absolute -right-20 top-10 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:px-8 lg:py-28">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Estratégia • Indicadores • Dados</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">Da estratégia ao resultado. Tudo conectado.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">Planeje com BSC, acompanhe indicadores e transforme desvios em ações. Dê clareza às equipes e reconheça os resultados com a Gestão de Prêmio.</p>
          <div className="mt-9 flex flex-wrap gap-4">
            <DemoLink source="home_hero" className="inline-flex items-center gap-3 rounded-full bg-cyan-400 px-7 py-4 font-semibold text-slate-950 hover:bg-cyan-300">Acesse a Demonstração <ArrowRight className="h-5 w-5" /></DemoLink>
            <Link href="/login" className="rounded-full border border-white/25 px-7 py-4 font-semibold hover:bg-white/10">Entrar no sistema</Link>
          </div>
          <p className="mt-5 text-sm text-slate-400">Acesso com um clique, sem cadastro. Dados fictícios para explorar.</p>
        </div>
        <div className="self-center rounded-2xl border border-white/15 bg-white/[0.05] p-7 shadow-2xl">
          <div className="flex items-center gap-3 text-cyan-300"><Target className="h-6 w-6" /><span className="text-sm font-semibold">ESTRATÉGIA EM MOVIMENTO</span></div>
          <h2 className="mt-5 text-2xl font-semibold">Uma visão completa dos resultados</h2>
          <div className="mt-6 grid gap-3">{['BSC: objetivos e relações de causa e efeito', 'Indicadores: metas, realizados e faróis', 'Execução: desvios, ações e reuniões', 'Prêmio: regras e memória de cálculo'].map((text, i) => <div key={text} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4"><span className="text-cyan-300">0{i+1}</span><span className="text-sm leading-6 text-slate-200">{text}</span></div>)}</div>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">Foco no que move sua gestão</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Quatro frentes. Uma base de resultados.</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{modules.map(({title, icon: Icon, text}) => <article key={title} className="rounded-2xl border border-slate-200 p-7"><Icon className="h-8 w-8 text-sky-700" /><h3 className="mt-6 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></article>)}</div>
    </section>
    <section className="bg-slate-50 px-4 py-16 text-center"><h2 className="text-3xl font-semibold">Veja os dados se transformarem em decisões.</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">Conheça a Empresa Demonstração: indicadores com histórico, mapa estratégico, planos de ação, reuniões e programas de prêmio preenchidos.</p><DemoLink source="home_footer" className="mt-7 inline-flex items-center gap-3 rounded-full bg-sky-700 px-7 py-4 font-semibold text-white hover:bg-sky-800">Acesse a Demonstração <ArrowRight className="h-5 w-5" /></DemoLink><p className="mt-5 text-sm"><Link href="/teste-gratis" className="font-medium text-sky-700 hover:underline">Solicitar meu trial</Link></p></section>
  </PublicShell>;
}
