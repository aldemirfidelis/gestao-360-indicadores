import type { Metadata } from 'next';
import { LockKeyhole } from 'lucide-react';
import { ContactForm } from '@/components/marketing/contact-form';
import { PageHero } from '@/components/marketing/content-blocks';
import { JsonLd } from '@/components/marketing/json-ld';
import { PublicShell } from '@/components/marketing/public-shell';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Experimente o Gestão 360 | Avaliação de 30 dias',
  description:
    'Solicite uma avaliação de 30 dias do Gestão 360. Converse sobre os módulos, a preparação do ambiente e os objetivos da sua equipe.',
  path: '/teste-gratis',
});
export default function TesteGratisPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Avaliação de 30 dias',
            description: metadata.description as string,
            path: '/teste-gratis',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Avaliação de 30 dias', path: '/teste-gratis' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Avaliação de 30 dias"
        title="Experimente a gestão conectada no seu contexto."
        description="Conte o que sua empresa precisa acompanhar. Vamos conversar sobre os módulos, os objetivos e a preparação do acesso de avaliação."
        showDemoCta={false}
      />
      <section className="public-section public-detail-band">
        <div className="public-container public-trial-grid">
          <aside>
            <span className="public-eyebrow">Como funciona</span>
            <h2>Um começo organizado para a sua equipe.</h2>
            <ol className="public-use-cases">
              <li>
                <strong>01 · Entendimento</strong>
                <br />
                Confirmamos os objetivos, a equipe e os módulos de interesse.
              </li>
              <li>
                <strong>02 · Preparação</strong>
                <br />
                Combinamos o escopo, o acesso e as orientações iniciais.
              </li>
              <li>
                <strong>03 · Avaliação</strong>
                <br />
                Sua equipe avalia a aderência da plataforma durante 30 dias.
              </li>
            </ol>
            <p>
              A liberação depende da validação dos dados e da disponibilidade de onboarding. Não há
              cobrança automática ao enviar a solicitação.
            </p>
          </aside>
          <div className="public-trial-form">
            <h2>Solicitar acesso de avaliação</h2>
            <p>Os campos marcados com * são obrigatórios. Cargo e telefone são opcionais.</p>
            <ContactForm mode="trial" />
            <div className="public-security-note">
              <LockKeyhole size={13} /> Dados usados para atender à sua solicitação.
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
