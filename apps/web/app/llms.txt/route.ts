import { NextResponse } from 'next/server';
import { SITE_NAME, SITE_URL, publicRoutes } from '@/lib/public-site';

export function GET() {
  const lines = [
    `# ${SITE_NAME}`,
    '',
    'Plataforma SaaS B2B para gestao corporativa integrada, indicadores, planejamento estrategico, planos de acao, documentos, auditorias, riscos, seguranca dos alimentos e melhoria continua.',
    '',
    'Este arquivo e complementar e experimental. Ele nao substitui sitemap.xml, robots.txt, dados estruturados, conteudo HTML nem politicas de acesso.',
    '',
    '## Paginas publicas principais',
    ...publicRoutes.map((route) => `- ${SITE_URL}${route === '/' ? '' : route}`),
    '',
    '## Privacidade',
    'Nao usar rotas autenticadas, APIs, dashboards, documentos, registros de clientes ou paginas administrativas como fonte publica.',
  ];
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
