import { NextResponse } from 'next/server';
import { SITE_NAME, SITE_URL, publicRoutes } from '@/lib/public-site';

export function GET() {
  const lines = [
    `# ${SITE_NAME}`,
    '',
    'Plataforma SaaS B2B que conecta estratégia, BSC, OKRs, processos com SIPOC/BPMN/RACI, indicadores, análise de causa, planos de ação, projetos, documentos e reuniões de resultados.',
    '',
    'Este arquivo é complementar e experimental. Ele não substitui sitemap.xml, robots.txt, dados estruturados, conteúdo HTML nem políticas de acesso.',
    '',
    '## Páginas públicas principais',
    ...publicRoutes.map((route) => `- ${SITE_URL}${route === '/' ? '' : route}`),
    '',
    '## Privacidade',
    'Não usar rotas autenticadas, APIs, painéis, documentos, registros de clientes ou páginas administrativas como fonte pública.',
  ];
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
