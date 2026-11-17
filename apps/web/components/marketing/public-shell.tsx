import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PublicNavigation } from './public-navigation';
import './public-site.css';

const footerGroups = [
  {
    title: 'Plataforma',
    links: [
      ['Módulos', '/modulos'],
      ['Processos', '/solucoes/gestao-de-processos'],
      ['Indicadores', '/solucoes/gestao-de-indicadores'],
      ['Projetos', '/solucoes/gestao-de-projetos'],
      ['Documentos', '/solucoes/gestao-de-documentos'],
      ['Recursos', '/recursos'],
    ],
  },
  {
    title: 'Conheça',
    links: [
      ['Sobre o Gestão 360', '/sobre'],
      ['Implantação', '/implantacao'],
      ['Segurança', '/seguranca'],
      ['Artigos e guias', '/conteudos'],
      ['Perguntas frequentes', '/conteudos/perguntas-frequentes'],
      ['Segmentos', '/segmentos'],
    ],
  },
  {
    title: 'Vamos conversar',
    links: [
      ['Demonstração', '/demonstracao'],
      ['Avaliação de 30 dias', '/teste-gratis'],
      ['Contato comercial', '/contato'],
      ['Suporte e SAC', '/suporte'],
      ['LGPD e direitos', '/lgpd'],
      ['Entrar no sistema', '/login'],
    ],
  },
];

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="public-site">
      <PublicNavigation />
      <main id="public-main">{children}</main>
      <footer id="rodape" className="public-footer">
        <div className="public-container public-footer-grid">
          <div className="public-footer-brand">
            <BrandLogo variant="horizontal" size="md" theme="dark" animated={false} />
            <p>
              Clareza para decidir.
              <br />
              Contexto para executar.
            </p>
            <span>Estratégia, processos e resultados conectados.</span>
          </div>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href}>
                      {label}
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="public-container public-footer-bottom">
          <span>© {new Date().getFullYear()} Gestão 360.</span>
          <div>
            <Link href="/politica-de-privacidade">Privacidade</Link>
            <Link href="/termos-de-uso">Termos de uso</Link>
          </div>
          <span>Feito para conectar a gestão.</span>
        </div>
      </footer>
    </div>
  );
}
