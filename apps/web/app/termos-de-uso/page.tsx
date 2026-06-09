import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Termos de uso',
  description: 'Termos públicos iniciais de uso do site institucional do Gestão 360 ? orientações sobre demonstração comercial.',
  path: '/termos-de-uso',
});

const sections = [
  ['Uso do site', 'As páginas públicas apresentam informações institucionais e comerciais sobre a plataforma Gestão 360. O acesso ao portal operacional exige credenciais autorizadas.'],
  ['Demonstração', 'Solicitacoes de demonstração não constituem contrato, proposta vinculante ou garantia de resultado. O escopo comercial deve ser validado em atendimento específico.'],
  ['Conteúdo', 'O conteúdo público tem finalidade informativa. Funcionalidades citadas refletem módulos existentes ou preparados no projeto, sem promessa de aderência automática a normas específicas.'],
  ['Responsabilidades', 'Usuários autenticados devem respeitar políticas internas, permissões e regras de uso definidas pela empresa contratante.'],
  ['Revisão jurídica', 'Este texto deve ser revisado pelo responsável jurídico/comercial antes de publicação definitiva como contrato formal.'],
];

export default function TermsPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Termos de uso', description: metadata.description as string, path: '/termos-de-uso' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Termos de uso', path: '/termos-de-uso' }])]} />
      <PageHero eyebrow="Termos" title="Termos de uso do site institucional." description="Regras iniciais para uso das páginas públicas, contato comercial e separação entre conteúdo institucional e portal autenticado." />
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl space-y-8 px-4 sm:px-6 lg:px-8">
          {sections.map(([title, text]) => (
            <section key={title}>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
              <p className="mt-3 text-base leading-8 text-slate-700">{text}</p>
            </section>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
