import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Seguranca, permissoes e rastreabilidade',
  description: 'Entenda os principios de seguranca do Gestao 360: autenticacao, tenant, permissoes, auditoria, historico e separacao entre publico e privado.',
  path: '/seguranca',
});

const items = [
  ['Separacao publico/privado', 'Paginas institucionais sao publicas. Portal, APIs, dashboards e dados de clientes exigem autenticacao.'],
  ['Tenant e permissoes', 'Registros operacionais respeitam empresa, usuario, perfil, modulo e escopo de area configurado.'],
  ['Auditoria', 'A plataforma registra historico de eventos e alteracoes conforme modulo, usuario e permissao.'],
  ['SEO seguro', 'Robots e noindex reduzem rastreamento indevido, mas nao substituem autenticacao e autorizacao.'],
];

export default function SegurancaPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Seguranca', description: metadata.description as string, path: '/seguranca' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Seguranca', path: '/seguranca' }])]} />
      <PageHero eyebrow="Seguranca" title="Conteudo publico sem exposicao de dados corporativos." description="A arquitetura publica foi organizada para SEO sem publicar telas internas, APIs, dashboards ou informacoes de clientes." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          {items.map(([title, text]) => (
            <div key={title} className="border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
