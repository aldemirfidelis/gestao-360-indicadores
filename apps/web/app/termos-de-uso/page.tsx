import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Termos de uso',
  description: 'Termos publicos iniciais de uso do site institucional do Gestao 360 e orientacoes sobre demonstracao comercial.',
  path: '/termos-de-uso',
});

const sections = [
  ['Uso do site', 'As paginas publicas apresentam informacoes institucionais e comerciais sobre a plataforma Gestao 360. O acesso ao portal operacional exige credenciais autorizadas.'],
  ['Demonstracao', 'Solicitacoes de demonstracao nao constituem contrato, proposta vinculante ou garantia de resultado. O escopo comercial deve ser validado em atendimento especifico.'],
  ['Conteudo', 'O conteudo publico tem finalidade informativa. Funcionalidades citadas refletem modulos existentes ou preparados no projeto, sem promessa de aderencia automatica a normas especificas.'],
  ['Responsabilidades', 'Usuarios autenticados devem respeitar politicas internas, permissoes e regras de uso definidas pela empresa contratante.'],
  ['Revisao juridica', 'Este texto deve ser revisado pelo responsavel juridico/comercial antes de publicacao definitiva como contrato formal.'],
];

export default function TermsPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Termos de uso', description: metadata.description as string, path: '/termos-de-uso' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Termos de uso', path: '/termos-de-uso' }])]} />
      <PageHero eyebrow="Termos" title="Termos de uso do site institucional." description="Regras iniciais para uso das paginas publicas, contato comercial e separacao entre conteudo institucional e portal autenticado." />
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
