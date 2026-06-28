import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { ContactForm } from '@/components/marketing/contact-form';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Suporte e evolução do Gestão 360',
  description: 'Conheça os canais e princípios de suporte do Gestão 360 para acompanhamento, evolução e melhoria contínua da plataforma.',
  path: '/suporte',
});

export default function SuportePage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Suporte', description: metadata.description as string, path: '/suporte' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Suporte', path: '/suporte' }])]} />
      <PageHero eyebrow="Suporte" title="Conte sua dúvida para a equipe do Gestão 360." description="Preencha o formulário com o contexto do problema. A solicitação será enviada ao suporte@gestao360.org para acompanhamento e retorno." />
      <section id="formulario" className="scroll-mt-20 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:px-8">
          <div className="border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Abrir uma solicitação</h2>
            <p className="mb-6 mt-2 text-sm leading-6 text-slate-600">
              Para agilizar a análise, informe a tela, o que você tentou fazer e o resultado apresentado.
            </p>
            <ContactForm mode="support" />
          </div>
          <aside className="space-y-4">
            {[
              ['Dúvidas de uso', 'Orientação sobre telas, fluxos, permissões e recursos disponíveis.'],
              ['Acesso e configuração', 'Ajuda com entrada no portal e configuração do ambiente. Nunca envie sua senha.'],
              ['LGPD e privacidade', 'Canal para exercer direitos sobre dados pessoais ou esclarecer o tratamento de dados.'],
            ].map(([title, text]) => (
              <div key={title} className="border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}
