import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { JsonLd } from '@/components/marketing/json-ld';
import { PageHero } from '@/components/marketing/content-blocks';
import { breadcrumbJsonLd, publicMetadata, webPageJsonLd } from '@/lib/public-site';
export const metadata: Metadata = publicMetadata({
  title: 'Recursos, governança e IA assistida | Gestão 360',
  description:
    'Conheça contexto dos registros, permissões, rastreabilidade, ferramentas de análise e recursos assistidos por IA.',
  path: '/recursos',
});
const resources = [
  [
    'Contexto dos registros',
    'Consulte vínculos, responsáveis e registros relacionados a partir do trabalho em andamento.',
    'Visão 360 e vínculos',
  ],
  [
    'Histórico e evidências',
    'Recupere alterações, comentários e evidências para entender a origem e o desdobramento das decisões.',
    'Rastreabilidade',
  ],
  [
    'Perfis e escopos',
    'Defina o acesso por empresa, perfil, módulo e área. A visibilidade acompanha as permissões do usuário.',
    'Governança de acesso',
  ],
  [
    'Ishikawa e 5 Porquês',
    'Estruture hipóteses e aprofunde a investigação da causa no contexto da tratativa.',
    'Análise de causa',
  ],
  [
    '5W2H e PDCA',
    'Organize o plano, acompanhe a execução e registre a verificação de eficácia conforme o fluxo da equipe.',
    'Melhoria contínua',
  ],
  [
    'Reuniões com continuidade',
    'Prepare resultados, conduza a análise e mantenha atas e encaminhamentos relacionados à execução.',
    'Rotina de gestão',
  ],
];
export default function RecursosPage() {
  return (
    <PublicShell>
      <JsonLd
        data={[
          webPageJsonLd({
            title: 'Recursos',
            description: metadata.description as string,
            path: '/recursos',
          }),
          breadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Recursos', path: '/recursos' },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Recursos da plataforma"
        title="Contexto para analisar. Estrutura para agir."
        description="Ferramentas que acompanham o trabalho, da investigação do problema ao controle de acesso e ao histórico das decisões."
      />
      <section className="public-section">
        <div className="public-container public-catalog-grid" style={{ marginTop: 0 }}>
          {resources.map(([title, description, label]) => (
            <article key={title}>
              <span className="public-eyebrow">{label}</span>
              <h2 style={{ fontSize: 26 }}>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="inteligencia-artificial" className="public-section public-ai">
        <div className="public-container public-body-grid">
          <div>
            <span className="public-eyebrow">IA assistida · disponibilidade condicionada</span>
            <h2>Uma ajuda na elaboração. A decisão continua com a equipe.</h2>
            <p>
              A IA atua como apoio em pontos específicos. O acesso depende de habilitação, provedor
              configurado e permissão do usuário. A demonstração pública não inclui esses recursos.
            </p>
          </div>
          <div>
            <ul className="public-use-cases">
              <li>
                <strong>Consulta de contexto:</strong> apoio para compreender registros autorizados
                e orientar a navegação.
              </li>
              <li>
                <strong>Reuniões:</strong> apoio na elaboração de resumos e rascunhos de atas.
              </li>
              <li>
                <strong>Documentos:</strong> apoio na elaboração, conferência e resumo do conteúdo.
              </li>
            </ul>
            <p>
              Respostas e rascunhos precisam ser conferidos por uma pessoa. Não há promessa de
              diagnóstico, previsão de resultados ou aprovação autônoma.
            </p>
            <Link href="/contato" className="public-text-link" style={{ marginTop: 24 }}>
              Converse sobre a disponibilidade <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
