// Visitantes do site e da demonstração (Portal Admin Global): contrato entre o
// rastreador do site (web) e a coleta da API. Nunca carrega o que a pessoa digita.
import { isDemoRouteAllowed } from './product-scope';

export const SITE_EVENT_TYPES = [
  /** Página do site aberta. */
  'page_view',
  /** Seção da página inicial que apareceu na tela (label = id da seção). */
  'section_view',
  /** Marco de rolagem da página inicial (label = 25, 50, 75 ou 100). */
  'scroll',
  /** Botão "Acesse a Demonstração" (label = onde estava o botão). */
  'demo_click',
  /** Sessão da demonstração aberta. */
  'demo_start',
  /** A demonstração não abriu (label = mensagem mostrada). */
  'demo_error',
  /** Página aberta dentro da demonstração. */
  'demo_page',
  /** "Entrar no sistema" (label = onde). */
  'login_click',
  /** "Solicitar meu trial" (label = onde). */
  'trial_click',
  /** Botão do WhatsApp (label = qual botão). */
  'whatsapp_click',
  /** Formulário de contato enviado (label = tipo da solicitação). */
  'form_submit',
] as const;
export type SiteEventType = (typeof SITE_EVENT_TYPES)[number];

/** Seções da página inicial, de cima para baixo (ids no HTML): a ordem define "até onde chegou". */
export const HOME_SECTIONS = ['inicio', 'frentes', 'chamada-final', 'rodape'] as const;

const ID_SEGMENT = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,})$/;
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;

/**
 * Caminho guardado nas visitas: sem parâmetros e sem identificadores, para somar
 * "/indicators/<id>" de todo mundo em "/indicators/:id". Null para o que não é caminho.
 */
export function normalizeSitePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.split(/[?#]/)[0];
  if (!path.startsWith('/')) return null;
  const segments = path
    .split('/')
    .filter(Boolean)
    .slice(0, 6)
    .map((segment) => {
      const s = segment.toLowerCase();
      return s.length > 60 || ID_SEGMENT.test(s) || !SAFE_SEGMENT.test(s) ? ':id' : s;
    });
  return `/${segments.join('/')}`;
}

/** Área da demonstração ("/gestao-premio/espelhos" → "gestao-premio"); null fora das rotas da demo. */
export function demoAreaOf(raw: string | null | undefined): string | null {
  const path = normalizeSitePath(raw);
  if (!path || path === '/' || !isDemoRouteAllowed(path)) return null;
  return path.split('/')[1];
}
