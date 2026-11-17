import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { ContactForm } from '@/components/marketing/contact-form';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { WHATSAPP_URL, breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Converse com a equipe | Gestão 360',
  description:
    'Fale sobre seus desafios, solicite uma apresentação ou converse sobre os módulos, a avaliação e a implantação do Gestão 360.',
  path: '/contato',
});
export default function ContatoPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Contato',
            description: metadata.description as string,
            path: '/contato',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Contato', path: '/contato' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Vamos conversar"
        title="Conte o que a sua empresa precisa conectar."
        description="Converse sobre os desafios da operação, os módulos e os próximos passos para conhecer o Gestão 360."
        showDemoCta={false}
      />
      <section className="public-section public-detail-band">
        <div className="public-container public-trial-grid">
          <aside>
            <span className="public-eyebrow">Contato comercial</span>
            <h2>Comece por uma boa conversa.</h2>
            <p>
              Conte quais áreas e resultados você quer acompanhar. A equipe ajuda a entender a
              aderência da plataforma e o escopo da avaliação.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-track="whatsapp_click"
              data-track-label="contact"
              className="public-button public-button-navy"
              style={{ marginTop: 26 }}
            >
              <MessageCircle size={17} /> Abrir WhatsApp
            </a>
            <p>Já utiliza a plataforma e precisa de ajuda?</p>
            <Link href="/suporte#formulario" className="public-text-link" style={{ marginTop: 14 }}>
              Fale com o suporte <ArrowRight size={16} />
            </Link>
          </aside>
          <div className="public-trial-form">
            <h2>Envie sua mensagem</h2>
            <p>Os campos com * são obrigatórios. Retornaremos pelo canal informado.</p>
            <ContactForm />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
