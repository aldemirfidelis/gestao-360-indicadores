import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Política de privacidade',
  description: 'Política de privacidade pública do Gestão 360 para contatos comerciais, analytics e separação de dados privados do portal.',
  path: '/politica-de-privacidade',
});

const sections = [
  ['Dados de contato', 'O formulário público coleta dados informados voluntariamente para retorno comercial. O sistema registra apenas o necessário para acompanhamento da solicitação.'],
  ['Analytics', 'Scripts de analytics só são carregados quando IDs públicos forem configurados por variáveis de ambiente. Eventos evitam dados pessoais desnecessários.'],
  ['Portal autenticado', 'Dados corporativos, documentos, indicadores, usuários e dashboards ficam em áreas autenticadas e protegidas por permissão.'],
  ['Cookies e preferencias', 'Preferencias locais, como fechar o balao do WhatsApp, podem ser salvas no navegador para melhorar a experiencia.'],
  ['Revisão', 'Esta página deve ser revisada juridicamente pelo proprietário antes de uso comercial definitivo.'],
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Política de privacidade', description: metadata.description as string, path: '/politica-de-privacidade' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Política de privacidade', path: '/politica-de-privacidade' }])]} />
      <PageHero eyebrow="Privacidade" title="Política de privacidade do Gestão 360." description="Texto público inicial para orientar visitantes sobre contato comercial, analytics e separação entre conteúdo público e dados privados." />
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
