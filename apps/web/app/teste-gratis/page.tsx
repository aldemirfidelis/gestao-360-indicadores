import type { Metadata } from 'next';
import { ContactForm } from '@/components/marketing/contact-form';
import { PageHero } from '@/components/marketing/content-blocks';
import { JsonLd } from '@/components/marketing/json-ld';
import { PublicShell } from '@/components/marketing/public-shell';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Solicite seu trial de 30 dias',
  description: 'Solicite um trial de 30 dias do Gestão 360 e avalie os módulos adequados à operação da sua empresa.',
  path: '/teste-gratis',
});

export default function TesteGratisPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Trial de 30 dias',
            description: metadata.description as string,
            path: '/teste-gratis',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Trial de 30 dias', path: '/teste-gratis' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Trial de 30 dias"
        title="Avalie o Gestão 360 no contexto da sua empresa."
        description="Envie sua solicitação. A equipe comercial receberá os dados em contato@gestao360.org e entrará em contato para organizar o acesso, os módulos e o início do período de avaliação."
      />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:px-8">
          <div className="border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Solicitar acesso de avaliação</h2>
            <p className="mb-6 mt-2 text-sm leading-6 text-slate-600">
              Conte quais áreas deseja avaliar para prepararmos um trial mais útil para sua equipe.
            </p>
            <ContactForm mode="trial" />
          </div>
          <aside className="border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-xl font-semibold text-slate-950">O que acontece depois?</h2>
            <ol className="mt-5 grid gap-4 text-sm leading-6 text-slate-700">
              <li><strong>1. Entendimento:</strong> confirmamos objetivos, equipe e módulos de interesse.</li>
              <li><strong>2. Preparação:</strong> organizamos o ambiente de avaliação e as orientações iniciais.</li>
              <li><strong>3. Trial:</strong> sua equipe usa o portal por 30 dias e avalia a aderência à operação.</li>
            </ol>
            <p className="mt-5 text-xs leading-5 text-slate-600">
              A liberação depende da validação dos dados e da disponibilidade de onboarding. A solicitação não gera cobrança automática.
            </p>
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}
