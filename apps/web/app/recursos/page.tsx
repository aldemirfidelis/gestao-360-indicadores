import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Recursos do Gestao 360',
  description: 'Conheca recursos de rastreabilidade, dashboards, permissoes, automacoes, Meu Dia, Visao 360, auditoria e seguranca no Gestao 360.',
  path: '/recursos',
});

const resources = [
  ['Meu Dia', 'Central diaria de prioridades, prazos, delegacoes, acompanhamento e recomendacoes assistidas.'],
  ['Visao 360', 'Painel de contexto do registro com vinculos, impactos, historico e registros relacionados autorizados.'],
  ['Automacoes', 'Fluxos, tarefas, aprovacoes, historico, escalonamentos e acompanhamento de execucoes.'],
  ['Rastreabilidade', 'Historico de alteracoes, responsaveis, evidencias e trilha de auditoria por modulo.'],
  ['Permissoes', 'Controle por perfil, modulo, empresa, area e escopo de visibilidade.'],
  ['Dashboards', 'Visoes executivas e operacionais conectadas aos registros de origem.'],
];

export default function RecursosPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Recursos', description: metadata.description as string, path: '/recursos' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Recursos', path: '/recursos' }])]} />
      <PageHero eyebrow="Recursos" title="Recursos que conectam contexto, execucao e governanca." description="A plataforma foi desenhada para reduzir navegacao desnecessaria e dar rastreabilidade a decisoes, acoes e evidencias." />
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
