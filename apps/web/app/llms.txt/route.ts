import { NextResponse } from 'next/server';
import { SITE_NAME, SITE_URL, publicRoutes } from '@/lib/public-site';

export function GET() {
  const lines = [
    `# ${SITE_NAME}`,
    '',
    'Plataforma SaaS B2B para gestão corporativa integrada, indicadores, planejamento estratégico, planos de ação, documentos, auditorias, riscos, segurança dos alimentos e melhoria contínua.',
    '',
    'Este arquivo é complementar e experimental. Ele não substitui sitemap.xml, robots.txt, dados estruturados, conteúdo HTML nem políticas de acesso.',
    '',
    '## Páginas públicas principais',
    ...publicRoutes.map((route) => `- ${SITE_URL}${route === '/' ? '' : route}`),
    '',
    '## Privacidade',
    'Não usar rotas autenticadas, APIs, dashboards, documentos, registros de clientes ou páginas administrativas como fonte pública.',
  ];
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
