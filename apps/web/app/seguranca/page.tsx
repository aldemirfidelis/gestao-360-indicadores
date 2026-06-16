import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Segurança, permissões e rastreabilidade',
  description: 'Entenda os princípios de segurança do Gestão 360: autenticação, tenant, permissões, auditoria, histórico e separação entre público e privado.',
  path: '/seguranca',
});

const items = [
  ['Separação público/privado', 'Páginas institucionais são públicas. Portal, APIs, painéis e dados de clientes exigem autenticação.'],
  ['Tenant e permissões', 'Registros operacionais respeitam empresa, usuário, perfil, módulo e escopo de área configurado.'],
  ['Auditoria', 'A plataforma registra histórico de eventos e alterações conforme módulo, usuário e permissão.'],
  ['SEO seguro', 'Robots e noindex reduzem rastreamento indevido, mas não substituem autenticação e autorização.'],
];

export default function SegurancaPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Segurança', description: metadata.description as string, path: '/seguranca' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Segurança', path: '/seguranca' }])]} />
      <PageHero eyebrow="Segurança" title="Conteúdo público sem exposição de dados corporativos." description="A arquitetura pública foi organizada para SEO sem publicar telas internas, APIs, painéis ou informações de clientes." />
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
