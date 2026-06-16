import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Implantação e onboarding do Gestão 360',
  description: 'Veja uma abordagem realista de implantação do Gestão 360: diagnóstico, configuração, dados, pilotos, treinamento e evolução.',
  path: '/implantacao',
});

const steps = [
  ['Diagnóstico', 'Entendimento de empresas, áreas, indicadores, documentos, processos e prioridades.'],
  ['Configuração', 'Parâmetros, usuários, permissões, módulos, empresas e estruturas organizacionais.'],
  ['Carga inicial', 'Importação ou cadastro de dados essenciais, evitando migrar controles sem curadoria.'],
  ['Piloto assistido', 'Uso por área ou processo prioritário antes de expandir a plataforma.'],
  ['Evolução', 'Ajuste de rotinas, conteúdos, painéis e indicadores conforme maturidade da gestão.'],
];

export default function ImplantacaoPage() {
  return (
    <PublicShell>
      <JsonLd data={[webPageJsonLd({ title: 'Implantação', description: metadata.description as string, path: '/implantacao' }), breadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Implantação', path: '/implantacao' }])]} />
      <PageHero eyebrow="Implantação" title="Implantação gradual, com foco em valor e governança." description="A plataforma deve entrar na rotina de gestão sem prometer resultado automático. O valor vem da combinação entre processo, dados e acompanhamento." />
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
