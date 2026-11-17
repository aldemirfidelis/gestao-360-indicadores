'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { DemoLink } from './demo-link';

const groups = [
  {
    label: 'Plataforma',
    href: '/modulos',
    intro: 'Uma base para conectar o trabalho.',
    links: [
      ['Visão dos módulos', '/modulos'],
      ['Estratégia e indicadores', '/solucoes/gestao-de-indicadores'],
      ['Processos: SIPOC, BPMN e RACI', '/solucoes/gestao-de-processos'],
      ['Projetos e portfólio', '/solucoes/gestao-de-projetos'],
      ['Documentos e padrões', '/solucoes/gestao-de-documentos'],
      ['Recursos da plataforma', '/recursos'],
    ],
  },
  {
    label: 'Soluções',
    href: '/solucoes',
    intro: 'Comece pelo desafio da sua gestão.',
    links: [
      ['Planejamento estratégico', '/solucoes/planejamento-estrategico'],
      ['Melhoria contínua', '/solucoes/melhoria-continua'],
      ['Planos de ação', '/solucoes/planos-de-acao'],
      ['Painéis executivos', '/solucoes/dashboards-executivos'],
      ['Gestão da qualidade', '/solucoes/gestao-da-qualidade'],
      ['Todas as soluções', '/solucoes'],
    ],
  },
  {
    label: 'Segmentos',
    href: '/segmentos',
    intro: 'Gestão adaptada ao contexto da operação.',
    links: [
      ['Indústria', '/segmentos/industria'],
      ['Serviços', '/segmentos/servicos'],
      ['Agronegócio', '/segmentos/agronegocio'],
      ['Alimentos e bebidas', '/segmentos/alimentos-e-bebidas'],
      ['Gestão corporativa', '/segmentos/gestao-corporativa'],
    ],
  },
  {
    label: 'Conteúdos',
    href: '/conteudos',
    intro: 'Conhecimento para a próxima decisão.',
    links: [
      ['Artigos', '/conteudos/artigos'],
      ['Guias', '/conteudos/guias'],
      ['Perguntas frequentes', '/conteudos/perguntas-frequentes'],
      ['Implantação', '/implantacao'],
      ['Segurança e acesso', '/seguranca'],
      ['Fale com a equipe', '/contato'],
    ],
  },
];

export function PublicNavigation() {
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setActive(null);
        setMobile(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (mobile) {
        setMobile(false);
        mobileButton.current?.focus();
      } else if (active) {
        root.current?.querySelector<HTMLButtonElement>(`[data-nav="${active}"]`)?.focus();
      }
      setActive(null);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [active, mobile]);
  return (
    <header
      className="public-header"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setActive(null);
          setMobile(false);
        }
      }}
    >
      <a className="public-skip" href="#public-main">
        Ir para o conteúdo
      </a>
      <div className="public-container public-nav-row">
        <Link href="/" aria-label="Página inicial do Gestão 360" className="public-logo">
          <BrandLogo variant="horizontal" size="md" theme="light" animated={false} />
        </Link>
        <nav className="public-desktop-nav" aria-label="Navegação principal">
          {groups.map((group) => (
            <div className="public-nav-group" key={group.label}>
              <button
                data-nav={group.label}
                aria-expanded={active === group.label}
                aria-controls={`nav-${group.label}`}
                onClick={() => setActive(active === group.label ? null : group.label)}
              >
                {group.label}
                <ChevronDown size={13} aria-hidden="true" />
              </button>
              {active === group.label && (
                <div id={`nav-${group.label}`} className="public-nav-panel">
                  <div>
                    <span className="public-eyebrow">{group.label}</span>
                    <p>{group.intro}</p>
                    <Link href={group.href} onClick={() => setActive(null)}>
                      Explorar <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                  <ul>
                    {group.links.map(([label, href]) => (
                      <li key={href}>
                        <Link href={href} onClick={() => setActive(null)}>
                          {label}
                          <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="public-nav-actions">
          <Link
            href="/login"
            data-track="login_click"
            data-track-label="public_header"
            className="public-login"
          >
            Entrar
          </Link>
          <DemoLink
            source="public_header"
            className="public-button public-button-small public-button-navy"
          >
            Demonstração <ArrowRight size={15} aria-hidden="true" />
          </DemoLink>
          <button
            className="public-menu-toggle"
            ref={mobileButton}
            aria-label={mobile ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobile}
            aria-controls="public-mobile-nav"
            onClick={() => {
              setMobile(!mobile);
              setActive(null);
            }}
          >
            {mobile ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav id="public-mobile-nav" className="public-mobile-nav" aria-label="Navegação no celular">
          {groups.map((group) => (
            <details key={group.label}>
              <summary>
                {group.label}
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <ul>
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} onClick={() => setMobile(false)}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <Link
            className="public-mobile-login"
            href="/login"
            data-track="login_click"
            data-track-label="mobile_header"
            onClick={() => setMobile(false)}
          >
            Entrar no sistema <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            className="public-mobile-login"
            href="/teste-gratis"
            data-track="trial_click"
            onClick={() => setMobile(false)}
          >
            Experimente o Gestão 360 <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      )}
    </header>
  );
}
