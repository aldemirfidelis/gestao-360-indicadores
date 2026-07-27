import type { Metadata } from 'next';
import { ContactForm } from '@/components/marketing/contact-form';
import { PageHero } from '@/components/marketing/content-blocks';
import { JsonLd } from '@/components/marketing/json-ld';
import { PublicShell } from '@/components/marketing/public-shell';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Agende uma demonstração',
  description:
    'Solicite uma demonstração do Gestão 360. Nossa equipe entra em contato pelo e-mail informado para apresentar a plataforma no contexto da sua empresa.',
  path: '/demonstracao',
});

export default function DemonstracaoPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Agendar demonstração',
            description: metadata.description as string,
            path: '/demonstracao',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Agendar demonstração', path: '/demonstracao' },
          ]),
        ]}
      />
      {/* Sem o CTA: o formulário de agendamento está logo abaixo. */}
      <PageHero
        eyebrow="Demonstração"
        title="Veja o Gestão 360 aplicado à sua operação."
        description="Preencha o formulário e nossa equipe entrará em contato pelo e-mail informado para enviar a demonstração e agendar uma apresentação com quem decide na sua empresa."
        showDemoCta={false}
      />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:px-8">
          <div className="border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Solicitar demonstração</h2>
            <p className="mb-6 mt-2 text-sm leading-6 text-slate-600">
              Conte quais módulos interessam à sua empresa para prepararmos uma demonstração dirigida ao seu contexto.
            </p>
            <ContactForm mode="demo" />
          </div>
          <aside className="border border-sky-200 bg-sky-50 p-6">
            <h2 className="text-xl font-semibold text-slate-950">O que acontece depois?</h2>
            <ol className="mt-5 grid gap-4 text-sm leading-6 text-slate-700">
              <li>
                <strong>1. Contato:</strong> respondemos pelo e-mail informado com o material da demonstração.
              </li>
              <li>
                <strong>2. Apresentação:</strong> agendamos uma sessão guiada nos módulos que interessam à sua operação.
              </li>
              <li>
                <strong>3. Próximos passos:</strong> avaliamos juntos o trial de 30 dias e o plano de implantação.
              </li>
            </ol>
            <p className="mt-5 text-xs leading-5 text-slate-600">
              O acesso à demonstração é liberado mediante solicitação, para garantir que cada ambiente seja preparado com
              dados adequados ao seu segmento.
            </p>
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}
