import type { Metadata } from 'next';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Implantação e onboarding do Gestão 360',
  description:
    'Veja uma abordagem realista de implantação do Gestão 360: diagnóstico, configuração, dados, pilotos, treinamento e evolução.',
  path: '/implantacao',
});

const steps = [
  [
    'Diagnóstico',
    'Entendimento de empresas, áreas, indicadores, documentos, processos e prioridades.',
  ],
  [
    'Configuração',
    'Parâmetros, usuários, permissões, módulos, empresas e estruturas organizacionais.',
  ],
  [
    'Carga inicial',
    'Importação ou cadastro de dados essenciais, evitando migrar controles sem curadoria.',
  ],
  ['Piloto assistido', 'Uso por área ou processo prioritário antes de expandir a plataforma.'],
  [
    'Evolução',
    'Ajuste de rotinas, conteúdos, painéis e indicadores conforme maturidade da gestão.',
  ],
];

export default function ImplantacaoPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Implantação',
            description: metadata.description as string,
            path: '/implantacao',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Implantação', path: '/implantacao' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Implantação"
        title="Um começo organizado. Uma evolução com a equipe."
        description="Defina prioridades, prepare a estrutura e leve a plataforma para a rotina. O plano de implantação é combinado conforme o escopo da sua empresa."
      />
      <section className="public-section">
        <div className="public-container">
          <div className="grid gap-3">
            {steps.map(([title, text], index) => (
              <div key={title} className="public-onboarding-step">
                <div className="public-eyebrow">{String(index + 1).padStart(2, '0')}</div>
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
