import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Implantacao e onboarding do Gestao 360',
  description: 'Veja uma abordagem realista de implantacao do Gestao 360: diagnostico, configuracao, dados, pilotos, treinamento e evolucao.',
  path: '/implantacao',
});

const steps = [
  ['Diagnostico', 'Entendimento de empresas, areas, indicadores, documentos, processos e prioridades.'],
  ['Configuracao', 'Parametros, usuarios, permissoes, modulos, empresas e estruturas organizacionais.'],
  ['Carga inicial', 'Importacao ou cadastro de dados essenciais, evitando migrar controles sem curadoria.'],
  ['Piloto assistido', 'Uso por area ou processo prioritario antes de expandir a plataforma.'],
  ['Evolucao', 'Ajuste de rotinas, conteudos, dashboards e indicadores conforme maturidade da gestao.'],
];

export default function ImplantacaoPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Implantacao', description: metadata.description as string, path: '/implantacao' }), breadcrumbJsonLd([{ name: 'Inicio', path: '/' }, { name: 'Implantacao', path: '/implantacao' }])]} />
      <PageHero eyebrow="Implantacao" title="Implantacao gradual, com foco em valor e governanca." description="A plataforma deve entrar na rotina de gestao sem prometer resultado automatico. O valor vem da combinacao entre processo, dados e acompanhamento." />
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-3">
            {steps.map(([title, text], index) => (
              <div key={title} className="grid gap-4 border border-slate-200 bg-slate-50 p-5 md:grid-cols-[80px,1fr]">
                <div className="text-3xl font-semibold text-emerald-700">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
