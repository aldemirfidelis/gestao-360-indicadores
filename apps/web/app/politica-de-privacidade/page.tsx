import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Politica de privacidade',
  description: 'Politica de privacidade publica do Gestao 360 para contatos comerciais, analytics e separacao de dados privados do portal.',
  path: '/politica-de-privacidade',
});

const sections = [
  ['Dados de contato', 'O formulario publico coleta dados informados voluntariamente para retorno comercial. O sistema registra apenas o necessario para acompanhamento da solicitacao.'],
  ['Analytics', 'Scripts de analytics so sao carregados quando IDs publicos forem configurados por variaveis de ambiente. Eventos evitam dados pessoais desnecessarios.'],
  ['Portal autenticado', 'Dados corporativos, documentos, indicadores, usuarios e dashboards ficam em areas autenticadas e protegidas por permissao.'],
  ['Cookies e preferencias', 'Preferencias locais, como fechar o balao do WhatsApp, podem ser salvas no navegador para melhorar a experiencia.'],
  ['Revisao', 'Esta pagina deve ser revisada juridicamente pelo proprietario antes de uso comercial definitivo.'],
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Politica de privacidade', description: metadata.description as string, path: '/politica-de-privacidade' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Politica de privacidade', path: '/politica-de-privacidade' }])]} />
      <PageHero eyebrow="Privacidade" title="Politica de privacidade do Gestao 360." description="Texto publico inicial para orientar visitantes sobre contato comercial, analytics e separacao entre conteudo publico e dados privados." />
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
