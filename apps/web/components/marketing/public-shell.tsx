import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BarChart3, FileText, Layers3, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-mark';
import { DEMO_PATH } from '@/lib/public-site';
import { DemoLink } from './demo-link';

const nav = [
  { href: '/solucoes', label: 'Soluções' },
  { href: '/modulos', label: 'Módulos' },
  { href: '/segmentos', label: 'Segmentos' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/conteudos', label: 'Conteúdos' },
];

const footerGroups = [
  {
    title: 'Soluções',
    links: [
      ['Indicadores', '/solucoes/gestao-de-indicadores'],
      ['Planejamento estratégico', '/solucoes/planejamento-estrategico'],
      ['Planos de ação', '/solucoes/planos-de-acao'],
      ['Qualidade', '/solucoes/gestao-da-qualidade'],
      ['Riscos', '/solucoes/gestao-de-riscos'],
    ],
  },
  {
    title: 'Institucional',
    links: [
      ['Sobre', '/sobre'],
      ['Segurança', '/seguranca'],
      ['Implantação', '/implantacao'],
      ['Suporte', '/suporte'],
      ['Demonstração', DEMO_PATH],
    ],
  },
  {
    title: 'Conteúdos',
    links: [
      ['Artigos', '/conteudos/artigos'],
      ['Guias', '/conteudos/guias'],
      ['Perguntas frequentes', '/conteudos/perguntas-frequentes'],
      ['Política de privacidade', '/politica-de-privacidade'],
      ['Termos de uso', '/termos-de-uso'],
    ],
  },
];

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Página inicial do Gestão 360" className="shrink-0">
            <BrandLogo />
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-6 lg:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-semibold text-slate-600 hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <DemoLink source="public_header" className="inline-flex items-center gap-2 bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Acesse a Demonstração
              <ArrowRight className="h-4 w-4" />
            </DemoLink>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr,2fr] lg:px-8">
          <div>
            <BrandLogo />
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Plataforma SaaS B2B para gestão corporativa integrada, indicadores, estratégia, planos de ação,
              documentos, auditorias, riscos e melhoria contínua.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-4">
              <FooterMetric icon={<BarChart3 className="h-4 w-4" />} label="Indicadores" />
              <FooterMetric icon={<Layers3 className="h-4 w-4" />} label="Modular" />
              <FooterMetric icon={<ShieldCheck className="h-4 w-4" />} label="Permissões" />
              <FooterMetric icon={<FileText className="h-4 w-4" />} label="Evidências" />
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-semibold">{group.title}</h2>
                <ul className="mt-4 space-y-2">
                  {group.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-slate-300 hover:text-white">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-400">
          Gestão 360. Conteúdo público separado do portal autenticado. Dados de clientes não são indexáveis.
        </div>
      </footer>
    </div>
  );
}

function FooterMetric({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 border border-white/10 px-3 py-2">
      {icon}
      <span>{label}</span>
    </div>
  );
}
