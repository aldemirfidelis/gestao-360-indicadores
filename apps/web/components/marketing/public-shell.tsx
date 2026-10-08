import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BarChart3, FileText, Layers3, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
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
    title: 'Módulos',
    links: [
      ['Gestão à Vista', '/modulos#gestao-a-vista'],
      ['Gestão de Prêmio', '/modulos#gestao-de-premio'],
      ['Todos os módulos', '/modulos'],
    ],
  },
  {
    title: 'Institucional',
    links: [
      ['Sobre', '/sobre'],
      ['Segurança', '/seguranca'],
      ['Implantação', '/implantacao'],
      ['Suporte', '/suporte'],
      ['SAC', '/suporte#formulario'],
      ['Contato Comercial', '/contato'],
      ['Acesse a Demonstração', '/demonstracao'],
      ['Trial de 30 dias', '/teste-gratis'],
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
      ['LGPD e direitos', '/lgpd'],
    ],
  },
];

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Página inicial do Gestão 360" className="shrink-0">
            <BrandLogo variant="horizontal" size="sm" theme="light" animated={true} />
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-6 2xl:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-semibold text-slate-600 hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {/* Ciano da marca com texto escuro: alto contraste no cabeçalho branco. */}
            <DemoLink
              source="public_header"
              className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-[#00F0FF]"
            >
              <span className="hidden sm:inline">Acesse a Demonstração</span>
              <span className="sm:hidden">Demonstração</span>
              <ArrowRight className="h-4 w-4" />
            </DemoLink>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr,2fr] lg:px-8">
          <div>
            <BrandLogo variant="horizontal" size="sm" theme="dark" animated={true} />
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              BSC, indicadores e dados conectados à execução: Meu Dia, Tarefas, Gestão à Vista e Gestão de Prêmio.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-4">
              <FooterMetric icon={<BarChart3 className="h-4 w-4" />} label="Gestão à vista" />
              <FooterMetric icon={<Layers3 className="h-4 w-4" />} label="BSC e dados" />
              <FooterMetric icon={<ShieldCheck className="h-4 w-4" />} label="Permissões" />
              <FooterMetric icon={<FileText className="h-4 w-4" />} label="Auditoria" />
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
          © 2026 Gestão 360. Todos os direitos reservados.
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
