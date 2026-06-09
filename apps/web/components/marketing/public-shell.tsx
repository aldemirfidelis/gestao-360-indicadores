import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BarChart3, FileText, Layers3, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-mark';
import { WHATSAPP_URL } from '@/lib/public-site';
import { WhatsAppButton } from './whatsapp-button';

const nav = [
  { href: '/solucoes', label: 'Solucoes' },
  { href: '/modulos', label: 'Modulos' },
  { href: '/segmentos', label: 'Segmentos' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/conteudos', label: 'Conteudos' },
  { href: '/contato', label: 'Contato' },
];

const footerGroups = [
  {
    title: 'Solucoes',
    links: [
      ['Indicadores', '/solucoes/gestao-de-indicadores'],
      ['Planejamento estrategico', '/solucoes/planejamento-estrategico'],
      ['Planos de acao', '/solucoes/planos-de-acao'],
      ['Qualidade', '/solucoes/gestao-da-qualidade'],
      ['Riscos', '/solucoes/gestao-de-riscos'],
    ],
  },
  {
    title: 'Institucional',
    links: [
      ['Sobre', '/sobre'],
      ['Seguranca', '/seguranca'],
      ['Implantacao', '/implantacao'],
      ['Suporte', '/suporte'],
      ['Contato', '/contato'],
    ],
  },
  {
    title: 'Conteudos',
    links: [
      ['Artigos', '/conteudos/artigos'],
      ['Guias', '/conteudos/guias'],
      ['Perguntas frequentes', '/conteudos/perguntas-frequentes'],
      ['Politica de privacidade', '/politica-de-privacidade'],
      ['Termos de uso', '/termos-de-uso'],
    ],
  },
];

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Pagina inicial do Gestao 360" className="shrink-0">
            <BrandLogo />
          </Link>
          <nav aria-label="Navegacao principal" className="hidden items-center gap-6 lg:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-semibold text-slate-600 hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 sm:inline-flex"
            >
              WhatsApp
            </a>
            <Link href="/login" className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-950">
              Login
            </Link>
            <Link href="/contato" className="inline-flex items-center gap-2 bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Demonstracao
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr,2fr] lg:px-8">
          <div>
            <BrandLogo />
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Plataforma SaaS B2B para gestao corporativa integrada, indicadores, estrategia, planos de acao,
              documentos, auditorias, riscos e melhoria continua.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-4">
              <FooterMetric icon={<BarChart3 className="h-4 w-4" />} label="Indicadores" />
              <FooterMetric icon={<Layers3 className="h-4 w-4" />} label="Modular" />
              <FooterMetric icon={<ShieldCheck className="h-4 w-4" />} label="Permissoes" />
              <FooterMetric icon={<FileText className="h-4 w-4" />} label="Evidencias" />
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
          Gestao 360. Conteudo publico separado do portal autenticado. Dados de clientes nao sao indexaveis.
        </div>
      </footer>
      <WhatsAppButton />
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
