import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Recursos do Gestão 360',
  description: 'Conheça recursos de rastreabilidade, painéis, permissões, automações, Meu Dia, Visão 360, auditoria e segurança no Gestão 360.',
  path: '/recursos',
});

const resources = [
  ['Meu Dia', 'Central diária de prioridades, prazos, delegações, acompanhamento e recomendações assistidas.'],
  ['Visão 360', 'Painel de contexto do registro com vínculos, impactos, histórico e registros relacionados autorizados.'],
  ['Automações', 'Fluxos, tarefas, aprovações, histórico, escalonamentos e acompanhamento de execuções.'],
  ['Rastreabilidade', 'Histórico de alterações, responsáveis, evidências e trilha de auditoria por módulo.'],
  ['Permissões', 'Controle por perfil, módulo, empresa, área e escopo de visibilidade.'],
  ['Painéis', 'Visões executivas e operacionais conectadas aos registros de origem.'],
];

export default function RecursosPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Recursos', description: metadata.description as string, path: '/recursos' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Recursos', path: '/recursos' }])]} />
      <PageHero eyebrow="Recursos" title="Recursos que conectam contexto, execução e governança." description="A plataforma foi desenhada para reduzir navegação desnecessária e dar rastreabilidade a decisões, ações e evidências." />
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {resources.map(([title, text]) => (
            <article key={title} className="border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
