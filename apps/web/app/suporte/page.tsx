import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { ContactForm } from '@/components/marketing/contact-form';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Suporte e atendimento | Gestão 360',
  description:
    'Envie uma dúvida sobre acesso, configuração ou uso da plataforma para a equipe de suporte do Gestão 360.',
  path: '/suporte',
});
export default function SuportePage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Suporte',
            description: metadata.description as string,
            path: '/suporte',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Suporte', path: '/suporte' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Suporte e atendimento"
        title="Vamos entender a sua dúvida."
        description="Conte em qual tela aconteceu, o que você tentou fazer e o resultado apresentado. A equipe receberá a solicitação para acompanhamento e retorno."
        showDemoCta={false}
      />
      <section id="formulario" className="public-section public-detail-band">
        <div className="public-container public-trial-grid">
          <aside>
            <span className="public-eyebrow">Como podemos ajudar</span>
            <h2>Contexto ajuda a encontrar o próximo passo.</h2>
            <ul className="public-use-cases">
              <li>
                <strong>Dúvidas de uso</strong>
                <br />
                Orientação sobre telas, fluxos, permissões e recursos disponíveis.
              </li>
              <li>
                <strong>Acesso e configuração</strong>
                <br />
                Ajuda para acessar o portal e entender a configuração do ambiente.
              </li>
              <li>
                <strong>LGPD e privacidade</strong>
                <br />
                Dúvidas sobre o tratamento de dados pessoais e os canais para exercer seus direitos.
              </li>
            </ul>
            <p>Descreva o problema sem informar senhas ou dados desnecessários.</p>
            <Link href="/lgpd" className="public-text-link" style={{ marginTop: 20 }}>
              Conheça os canais de privacidade <ArrowRight size={16} />
            </Link>
          </aside>
          <div className="public-trial-form">
            <h2>Abrir uma solicitação</h2>
            <p>
              Os campos com * são obrigatórios. Inclua as informações necessárias para entendermos a
              dúvida.
            </p>
            <ContactForm mode="support" />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
