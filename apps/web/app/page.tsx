import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
  GitBranch,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { PublicShell } from '@/components/marketing/public-shell';
import { DemoLink } from '@/components/marketing/demo-link';
import { JsonLd } from '@/components/marketing/json-ld';
import { FaqBlock } from '@/components/marketing/content-blocks';
import {
  ConnectedJourney,
  ImprovementWorkbench,
  ModuleExplorer,
  ProcessWorkbench,
  ProjectCurve,
} from '@/components/marketing/product-experience';
import { landingFaq } from '@/lib/marketing-catalog';
import {
  publicMetadata,
  organizationJsonLd,
  websiteJsonLd,
  softwareJsonLd,
  faqJsonLd,
} from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Gestão 360 | Estratégia, processos e execução conectados',
  description:
    'Conecte BSC, OKRs, processos, indicadores, planos de ação, projetos e documentos. Conheça a demonstração e solicite uma avaliação de 30 dias.',
  path: '/',
});

export default function Home() {
  return (
    <PublicShell>
      <JsonLd
        data={[organizationJsonLd(), websiteJsonLd(), softwareJsonLd(), faqJsonLd(landingFaq)]}
      />
      <section id="inicio" className="public-hero">
        <div className="public-container public-hero-grid">
          <div className="public-hero-copy">
            <span className="public-eyebrow">Plataforma de gestão corporativa</span>
            <h1>
              Da estratégia à execução.
              <br />
              <em>Sua gestão, conectada.</em>
            </h1>
            <p>
              Conecte objetivos, processos e indicadores ao trabalho da equipe. Investigue desvios,
              conduza planos e acompanhe projetos sem perder o contexto das decisões.
            </p>
            <div className="public-actions">
              <DemoLink source="home_hero" className="public-button public-button-cyan">
                Conhecer a demonstração <ArrowRight size={17} aria-hidden="true" />
              </DemoLink>
              <Link
                href="/teste-gratis"
                data-track="trial_click"
                data-track-label="home_hero"
                className="public-button public-button-outline"
              >
                Experimente o Gestão 360
              </Link>
            </div>
            <p className="hero-note">Demonstração de consulta. Sem cadastro. Dados fictícios.</p>
            <Link className="hero-modules-link" href="#frentes">
              Explore os módulos da plataforma <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <figure className="hero-product">
            <div className="product-window">
              <div className="product-window-bar">
                <i />
                <i />
                <i />
                <span>Gestão 360 / Painel executivo</span>
                <ShieldCheck size={11} aria-hidden="true" />
              </div>
              <Image
                src="/marketing/painel-executivo.webp"
                alt="Interface real do Painel Executivo do Gestão 360, com indicadores de exemplo, resultados por área e planos de ação"
                width={1440}
                height={1040}
                sizes="(max-width: 960px) 90vw, 48vw"
                priority
              />
            </div>
            <figcaption>
              <span>
                <CheckCircle2 size={11} aria-hidden="true" /> Interface real do produto
              </span>
              <span>Dados demonstrativos</span>
            </figcaption>
          </figure>
        </div>
        <div className="public-container hero-foundation">
          <span>Uma base para a gestão</span>
          <ul>
            {[
              [GitBranch, 'Processos e responsabilidades'],
              [Layers3, 'Estratégia e execução'],
              [ShieldCheck, 'Perfis e permissões'],
              [FileCheck2, 'Documentos e histórico'],
            ].map(([Icon, label]) => {
              const FeatureIcon = Icon as typeof GitBranch;
              return (
                <li key={String(label)}>
                  <FeatureIcon size={14} aria-hidden="true" />
                  {String(label)}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="public-intro">
        <div className="public-container public-intro-grid">
          <div>
            <span className="public-eyebrow">O contexto faz a diferença</span>
            <h2>
              O indicador mostra o sinal.
              <br />A gestão conecta o que vem depois.
            </h2>
          </div>
          <p>
            Um resultado abaixo da meta precisa chegar à análise, ao responsável e à ação. O Gestão
            360 aproxima essas etapas e mantém os vínculos entre o que foi planejado, o trabalho
            realizado e o resultado acompanhado.
          </p>
        </div>
      </section>

      <section id="gestao-conectada" className="public-section">
        <div className="public-container">
          <div className="public-section-heading">
            <span className="public-eyebrow">Veja como tudo se conecta</span>
            <h2>
              Um caminho contínuo.
              <br />
              Da direção ao resultado.
            </h2>
            <p>
              Explore as etapas de um atendimento fictício e veja como cada decisão ganha contexto
              para a próxima ação.
            </p>
          </div>
          <ConnectedJourney />
        </div>
      </section>

      <section id="processos" className="public-section process-section">
        <div className="public-container">
          <div className="process-section-top">
            <div className="public-section-heading">
              <span className="public-eyebrow">Gestão de processos</span>
              <h2>
                Desenhe o trabalho.
                <br />
                Conecte a operação.
              </h2>
            </div>
            <div>
              <p>
                Mapeie o processo, defina responsabilidades e relacione as atividades aos
                indicadores, documentos e iniciativas de melhoria. O desenho passa a fazer parte da
                gestão.
              </p>
              <Link href="/solucoes/gestao-de-processos" className="public-text-link">
                Conheça a gestão de processos <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <ProcessWorkbench />
          <div className="process-connections">
            <strong>Processos conectados a</strong>
            <span>Indicadores</span>
            <ArrowRight size={12} aria-hidden="true" />
            <span>Documentos</span>
            <ArrowRight size={12} aria-hidden="true" />
            <span>Planos de ação</span>
            <ArrowRight size={12} aria-hidden="true" />
            <span>Projetos</span>
          </div>
        </div>
      </section>

      <section id="melhoria-continua" className="public-section">
        <div className="public-container">
          <div className="public-section-heading">
            <span className="public-eyebrow">Análise de causa e melhoria</span>
            <h2>
              Do problema observado
              <br />à ação que pode ser verificada.
            </h2>
            <p>
              Investigue a causa, organize o plano e acompanhe a eficácia. As ferramentas de análise
              fazem parte da tratativa.
            </p>
          </div>
          <ImprovementWorkbench />
          <div style={{ marginTop: 26 }}>
            <Link href="/solucoes/melhoria-continua" className="public-text-link">
              Conheça as ferramentas de melhoria <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="public-section public-product-section">
        <div className="public-container public-split">
          <div className="public-section-heading">
            <span className="public-eyebrow">Documentos e padrões</span>
            <h2>
              O jeito de trabalhar.
              <br />
              Na versão certa.
            </h2>
            <p>
              Escreva procedimentos no editor visual, organize a revisão e publique o documento que
              a equipe precisa consultar.
            </p>
            <ul className="public-feature-list">
              <li>
                <Check size={16} aria-hidden="true" /> Revisões, responsáveis e fluxo de aprovação.
              </li>
              <li>
                <Check size={16} aria-hidden="true" /> PDF oficial, busca e histórico documental.
              </li>
              <li>
                <Check size={16} aria-hidden="true" /> Leitura obrigatória acompanhada no Meu Dia.
              </li>
            </ul>
            <Link href="/solucoes/gestao-de-documentos" className="public-text-link">
              Explore a gestão de documentos <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div
            className="document-preview"
            aria-label="Exemplo ilustrativo de procedimento e fluxo de publicação"
          >
            <div className="document-preview-toolbar">
              <span>
                <FileCheck2 size={15} aria-hidden="true" /> Documentos / Procedimentos
              </span>
              <span>Exemplo ilustrativo</span>
            </div>
            <div className="document-sheet">
              <span className="doc-label">POP · ATENDIMENTO · REVISÃO 02</span>
              <h3>Triagem de solicitações</h3>
              <div className="doc-meta">Operações · Responsável definido · Versão publicada</div>
              <h4>1. Objetivo</h4>
              <p>
                Estabelecer critérios para receber, classificar e encaminhar as solicitações da
                equipe.
              </p>
              <h4>2. Critérios de triagem</h4>
              <p>
                Registrar a necessidade, verificar os requisitos e indicar o responsável pela
                próxima etapa.
              </p>
              <span className="doc-status">
                <CheckCircle2 size={11} aria-hidden="true" /> Disponível para leitura
              </span>
            </div>
            <div className="document-steps">
              <span>
                <CheckCircle2 size={12} aria-hidden="true" /> Elaboração
              </span>
              <ArrowRight size={11} aria-hidden="true" />
              <span>
                <CheckCircle2 size={12} aria-hidden="true" /> Revisão
              </span>
              <ArrowRight size={11} aria-hidden="true" />
              <span>
                <CheckCircle2 size={12} aria-hidden="true" /> Publicação
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section public-projects">
        <div className="public-container public-split">
          <div className="public-section-heading">
            <span className="public-eyebrow">Projetos e portfólio</span>
            <h2>
              Planeje a mudança.
              <br />
              Acompanhe a entrega.
            </h2>
            <p>
              Reúna cronograma, avanço físico e contexto financeiro para discutir prioridades e
              identificar pontos de atenção no portfólio.
            </p>
            <ul className="public-feature-list">
              <li>
                <Check size={16} aria-hidden="true" /> Tarefas, marcos, equipe e Gantt.
              </li>
              <li>
                <Check size={16} aria-hidden="true" /> Curva S com planejado e medições do realizado.
              </li>
              <li>
                <Check size={16} aria-hidden="true" /> Orçamento, custos, riscos e atualizações.
              </li>
            </ul>
            <Link href="/solucoes/gestao-de-projetos" className="public-text-link">
              Conheça a gestão de projetos <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ProjectCurve />
        </div>
      </section>

      <section id="frentes" className="public-section">
        <div className="public-container">
          <div className="public-section-heading">
            <span className="public-eyebrow">Explore a plataforma</span>
            <h2>
              Comece pelo seu desafio.
              <br />
              Encontre as conexões.
            </h2>
            <p>
              Conheça as frentes disponíveis e como elas participam da rotina de gestão. O acesso
              aos recursos varia conforme o plano e as permissões da empresa.
            </p>
          </div>
          <ModuleExplorer />
          <div style={{ marginTop: 28 }}>
            <Link href="/modulos" className="public-text-link">
              Ver todos os módulos e seus recursos <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="public-section public-ai">
        <div className="public-container public-ai-grid">
          <div>
            <span className="public-eyebrow">
              <Sparkles size={15} style={{ display: 'inline', marginRight: 8 }} aria-hidden="true" /> Inteligência
              artificial assistida
            </span>
            <h2>
              Apoio para organizar.
              <br />
              Critério humano para decidir.
            </h2>
          </div>
          <div className="public-ai-copy">
            <p>
              Recursos assistidos ajudam a consultar contexto, preparar resumos de reuniões e
              trabalhar com documentos. As sugestões entram como apoio à análise de quem conhece a
              operação.
            </p>
            <p>
              Disponibilidade condicionada à configuração, ao provedor e às permissões. Conteúdos
              precisam de conferência humana. A demonstração pública não inclui IA.
            </p>
            <Link href="/recursos#inteligencia-artificial" className="public-text-link">
              Entenda os recursos assistidos <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="public-section-heading">
            <span className="public-eyebrow">Mais clareza na rotina</span>
            <h2>
              Decisões com contexto.
              <br />
              Compromissos acompanháveis.
            </h2>
          </div>
          <div className="public-benefits-grid">
            {[
              [
                '01',
                'Enxergue as prioridades',
                'Indicadores, prazos e pendências ajudam a identificar onde a equipe precisa concentrar a atenção.',
              ],
              [
                '02',
                'Defina quem faz',
                'Responsáveis, áreas e matriz RACI tornam as atribuições consultáveis ao longo do processo.',
              ],
              [
                '03',
                'Mantenha o histórico',
                'Registros e vínculos ajudam a recuperar a origem de uma decisão e acompanhar seus desdobramentos.',
              ],
              [
                '04',
                'Feche o ciclo',
                'Planos, evidências e verificação de eficácia aproximam a execução da revisão dos resultados.',
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <FaqBlock faq={landingFaq} />
      <section id="chamada-final" className="public-final">
        <div className="public-container public-final-grid">
          <div>
            <span className="public-eyebrow">Veja o Gestão 360 em ação</span>
            <h2>
              Conheça a plataforma.
              <br />
              Imagine a sua gestão conectada.
            </h2>
            <p>
              Explore a demonstração com dados fictícios ou solicite uma avaliação de 30 dias para
              conversar sobre o contexto da sua empresa.
            </p>
          </div>
          <div className="public-final-actions">
            <DemoLink source="home_footer" className="public-button public-button-cyan">
              Conhecer a demonstração <ArrowRight size={16} aria-hidden="true" />
            </DemoLink>
            <Link
              href="/teste-gratis"
              data-track="trial_click"
              data-track-label="home_footer"
              className="public-button public-button-outline"
            >
              Experimente o Gestão 360
            </Link>
            <span>
              <LockKeyhole size={10} style={{ display: 'inline', marginRight: 4 }} aria-hidden="true" /> Solicitação
              sem cobrança automática.
            </span>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
