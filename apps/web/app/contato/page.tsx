import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { ContactForm } from '@/components/marketing/contact-form';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { WHATSAPP_URL, breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Contato e demonstração do Gestão 360',
  description: 'Solicite uma demonstração do Gestão 360 ou fale pelo WhatsApp para conhecer os módulos de gestão corporativa integrada.',
  path: '/contato',
});

export default function ContatoPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Contato', description: metadata.description as string, path: '/contato' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Contato', path: '/contato' }])]} />
      <PageHero eyebrow="Contato" title="Fale com a equipe do Gestão 360." description="Use o formulário para solicitar uma demonstração ou converse pelo WhatsApp com uma mensagem profissional já preenchida." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr,0.8fr] lg:px-8">
          <div className="border border-slate-200 bg-white p-6">
            <ContactForm />
          </div>
          <aside className="space-y-4">
            <div className="border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-950">WhatsApp comercial</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                O botão usa o número 5564981009108 e registra apenas evento de clique, página de origem e parâmetros de campanha quando existirem.
              </p>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Abrir WhatsApp
              </a>
            </div>
            <div className="border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-950">Privacidade</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                O formulário foi preparado para retorno comercial. Dados internos, dashboards e registros de clientes continuam protegidos no portal autenticado.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}
