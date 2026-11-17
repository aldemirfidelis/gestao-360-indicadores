'use client';

import Link from 'next/link';
import { useState, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  FileCheck2,
  GitBranch,
  Target,
  TrendingUp,
} from 'lucide-react';
import { activeProductModules, productGroups } from '@/lib/marketing-catalog';

function navigateTabs(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  count: number,
  select: (index: number) => void,
) {
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? count - 1
        : ['ArrowRight', 'ArrowDown'].includes(event.key)
          ? (index + 1) % count
          : ['ArrowLeft', 'ArrowUp'].includes(event.key)
            ? (index + count - 1) % count
            : -1;
  if (next < 0) return;
  event.preventDefault();
  select(next);
  event.currentTarget.parentElement
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [next]?.focus();
}

const journey = [
  {
    name: 'Estratégia',
    title: 'Comece pelo resultado que importa.',
    text: 'Desdobre a direção da empresa em objetivos e resultados acompanháveis. BSC e OKRs ajudam a dar contexto à escolha dos indicadores.',
    detail: 'Objetivo: oferecer um atendimento previsível',
    href: '/solucoes/planejamento-estrategico',
  },
  {
    name: 'Processos',
    title: 'Entenda o trabalho por trás da meta.',
    text: 'Delimite o processo com SIPOC, desenhe o fluxo em BPMN e defina quem participa com RACI. Relacione os padrões e os indicadores.',
    detail: 'Processo: atender e concluir solicitações',
    href: '/solucoes/gestao-de-processos',
  },
  {
    name: 'Indicadores',
    title: 'Veja o sinal. Entenda o contexto.',
    text: 'Compare resultados e metas, consulte o histórico e identifique quem acompanha cada indicador. O farol orienta a próxima conversa.',
    detail: 'Indicador: cumprimento de SLA',
    href: '/solucoes/gestao-de-indicadores',
  },
  {
    name: 'Desvios',
    title: 'O resultado fora da meta pede atenção.',
    text: 'Mantenha o desvio ligado ao indicador e ao período. A equipe consegue investigar o problema com o contexto do resultado que o originou.',
    detail: 'Desvio: entregas abaixo do SLA estabelecido',
    href: '/solucoes/gestao-de-indicadores',
  },
  {
    name: 'Análise de causa',
    title: 'Investigue antes de escolher a ação.',
    text: 'Organize hipóteses com Ishikawa e aprofunde a investigação com os 5 Porquês. Registre a causa para orientar o plano.',
    detail: 'Hipótese: solicitações sem triagem padronizada',
    href: '/solucoes/melhoria-continua',
  },
  {
    name: 'Planos de ação',
    title: 'Transforme a análise em compromisso.',
    text: 'Estruture o 5W2H, defina responsável e prazo, registre evidências e acompanhe a execução com PDCA e verificação de eficácia.',
    detail: 'Ação: padronizar a triagem de solicitações',
    href: '/solucoes/planos-de-acao',
  },
  {
    name: 'Projetos',
    title: 'Dê estrutura às mudanças maiores.',
    text: 'Organize iniciativas em projetos com tarefas, marcos, equipe, custos e riscos. Compare o avanço planejado com as medições reais.',
    detail: 'Projeto: revisão do fluxo de atendimento',
    href: '/solucoes/gestao-de-projetos',
  },
  {
    name: 'Acompanhamento',
    title: 'Mantenha as decisões em movimento.',
    text: 'Use Meu Dia, tarefas e reuniões de resultados para acompanhar prazos, responsabilidades e pendências relacionadas.',
    detail: 'Próxima revisão: reunião de resultados da área',
    href: '/solucoes/dashboards-executivos',
  },
  {
    name: 'Resultados',
    title: 'Volte ao indicador e verifique a eficácia.',
    text: 'Consulte a evolução dos resultados e as evidências do plano. A equipe avalia o que funcionou e o que precisa ser revisto no próximo ciclo.',
    detail: 'Verificação: comparar o SLA após a mudança',
    href: '/solucoes/melhoria-continua',
  },
];

function SampleVisual({ step }: { step: number }) {
  if (step === 0)
    return (
      <div className="sample-objective">
        <span className="sample-kicker">
          <Target size={16} aria-hidden="true" /> OBJETIVO ESTRATÉGICO
        </span>
        <h4>Atendimento previsível</h4>
        <p>Perspectiva de clientes</p>
        <div className="sample-linked">
          <span>INDICADOR VINCULADO</span>
          <strong>Cumprimento de SLA</strong>
          <small>Meta de referência: 95%</small>
        </div>
      </div>
    );
  if (step === 1)
    return (
      <div className="sample-mini-flow">
        <span className="sample-kicker">
          <GitBranch size={16} aria-hidden="true" /> FLUXO DO PROCESSO
        </span>
        {[
          'Receber solicitação',
          'Realizar triagem',
          'Executar e validar',
          'Concluir atendimento',
        ].map((label, i) => (
          <div key={label}>
            <span>{i + 1}</span>
            {label}
            {i < 3 && <ArrowRight size={16} aria-hidden="true" />}
          </div>
        ))}
      </div>
    );
  if ([2, 3, 8].includes(step))
    return (
      <div className="sample-indicator">
        <span className="sample-kicker">CUMPRIMENTO DE SLA</span>
        <div className="sample-value">
          <strong>{step === 8 ? '96%' : '88%'}</strong>
          <span className={step === 8 ? 'sample-positive' : 'sample-attention'}>
            {step === 8 ? 'Na meta' : 'Abaixo da meta'}
          </span>
        </div>
        <div className="sample-chart">
          <svg
            viewBox="0 0 360 120"
            role="img"
            aria-label={
              step === 8
                ? 'Exemplo ilustrativo de evolução do SLA até 96 por cento'
                : 'Exemplo ilustrativo de SLA de 88 por cento, abaixo da meta de 95'
            }
          >
            <path d="M12 25H348 M12 65H348 M12 105H348" stroke="#dce3eb" fill="none" />
            <path d="M12 36H348" stroke="#8190a6" strokeDasharray="5 5" />
            <path
              d={
                step === 8
                  ? 'M12 100 L78 82 L144 91 L210 62 L276 40 L348 28'
                  : 'M12 64 L78 50 L144 66 L210 55 L276 75 L348 84'
              }
              stroke={step === 8 ? '#087c72' : '#bd7420'}
              strokeWidth="3"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="sample-chart-caption">
          <span>Histórico do período</span>
          <span>Meta: 95%</span>
        </div>
      </div>
    );
  if (step === 4)
    return (
      <div className="sample-whys">
        <span className="sample-kicker">5 PORQUÊS · INVESTIGAÇÃO</span>
        {[
          'Por que houve atraso?',
          'A triagem começou depois do previsto.',
          'Por que a triagem começou tarde?',
          'O critério de prioridade não estava definido.',
        ].map((text, i) => (
          <div key={text} className={i % 2 === 0 ? 'sample-question' : ''}>
            <span>{i % 2 === 0 ? '?' : '↳'}</span>
            {text}
          </div>
        ))}
        <p>Hipótese a validar com a equipe.</p>
      </div>
    );
  if (step === 6)
    return (
      <div className="sample-project">
        <span className="sample-kicker">PROJETO · FLUXO DE ATENDIMENTO</span>
        {['Mapear o processo', 'Revisar a triagem', 'Orientar a equipe', 'Medir os resultados'].map(
          (label, i) => (
            <div className="sample-gantt-row" key={label}>
              <span>{label}</span>
              <div>
                <i style={{ marginLeft: `${i * 17}%`, width: `${i === 0 ? 36 : 32}%` }} />
              </div>
            </div>
          ),
        )}
        <div className="sample-chart-caption">
          <span>Planejamento por etapa</span>
          <span>4 marcos</span>
        </div>
      </div>
    );
  return (
    <div className="sample-action">
      <span className="sample-kicker">
        {step === 7 ? 'MEU DIA · PRÓXIMOS PASSOS' : 'PLANO DE AÇÃO · 5W2H'}
      </span>
      <h4>Padronizar a triagem</h4>
      {[
        ['Responsável', 'Equipe de operações'],
        ['Prazo', 'Próxima revisão mensal'],
        ['Evidência', 'Procedimento revisado'],
      ].map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <p>
        <Circle size={13} aria-hidden="true" />{' '}
        {step === 7 ? 'Validar o procedimento na reunião' : 'Em acompanhamento'}
      </p>
    </div>
  );
}

export function ConnectedJourney() {
  const [selected, setSelected] = useState(2);
  const current = journey[selected];
  return (
    <div className="journey-experience">
      <div className="journey-tabs" role="tablist" aria-label="Etapas da gestão conectada">
        {journey.map((step, i) => (
          <button
            key={step.name}
            id={`journey-tab-${i}`}
            role="tab"
            aria-selected={selected === i}
            aria-controls="journey-panel"
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => navigateTabs(event, i, journey.length, setSelected)}
          >
            <span>0{i + 1}</span>
            {step.name}
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div
        className="journey-panel"
        id="journey-panel"
        role="tabpanel"
        aria-labelledby={`journey-tab-${selected}`}
        tabIndex={0}
      >
        <div className="journey-copy">
          <p className="public-eyebrow">
            {String(selected + 1).padStart(2, '0')} / {current.name}
          </p>
          <h3>{current.title}</h3>
          <p>{current.text}</p>
          <Link href={current.href} className="public-text-link">
            Conheça o recurso <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="journey-sample">
          <div className="sample-toolbar">
            <span className="sample-dot" /> Gestão 360 <span>Exemplo ilustrativo</span>
          </div>
          <SampleVisual step={selected} />
          <div className="sample-context">
            <GitBranch size={14} aria-hidden="true" />
            <span>{current.detail}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const processViews = [
  {
    name: 'SIPOC',
    title: 'Enxergue o processo de ponta a ponta.',
    text: 'Fornecedores, entradas, etapas, saídas e clientes: estabeleça os limites antes de discutir os detalhes.',
  },
  {
    name: 'BPMN',
    title: 'Dê forma ao fluxo de trabalho.',
    text: 'Represente atividades, decisões e participantes em um fluxo que a equipe pode consultar e revisar.',
  },
  {
    name: 'RACI',
    title: 'Deixe as responsabilidades claras.',
    text: 'Defina quem executa, responde, é consultado ou informado em cada atividade do processo.',
  },
];

export function ProcessWorkbench() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="process-workbench">
      <div className="process-tabs" role="tablist" aria-label="Ferramentas de gestão de processos">
        {processViews.map((view, i) => (
          <button
            id={`process-tab-${i}`}
            key={view.name}
            role="tab"
            aria-selected={selected === i}
            aria-controls="process-panel"
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => navigateTabs(event, i, 3, setSelected)}
          >
            {view.name}
          </button>
        ))}
      </div>
      <div
        id="process-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`process-tab-${selected}`}
      >
        <div className="process-view-heading">
          <h3>{processViews[selected].title}</h3>
          <p>{processViews[selected].text}</p>
        </div>
        <div className="process-canvas">
          {selected === 0 && (
            <div className="sipoc-example">
              {[
                ['S', 'Fornecedores', 'Cliente', 'Equipe comercial'],
                ['I', 'Entradas', 'Solicitação', 'Requisitos'],
                ['P', 'Processo', 'Triar → Executar', 'Validar → Concluir'],
                ['O', 'Saídas', 'Entrega validada', 'Registro atualizado'],
                ['C', 'Clientes', 'Solicitante', 'Área de negócio'],
              ].map(([letter, label, a, b]) => (
                <div key={letter}>
                  <span>{letter}</span>
                  <h4>{label}</h4>
                  <p>{a}</p>
                  <p>{b}</p>
                </div>
              ))}
            </div>
          )}
          {selected === 1 && (
            <div className="bpmn-example">
              <svg
                viewBox="0 0 760 200"
                role="img"
                aria-label="Exemplo BPMN: receber solicitação, realizar triagem, decidir se está completa, executar ou solicitar complemento e concluir"
              >
                <defs>
                  <marker
                    id="bpmn-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M0 0L10 5L0 10" fill="#7b8ca4" />
                  </marker>
                </defs>
                <path
                  d="M63 70H100 M245 70H305 M355 70H415 M565 70H680 M330 95V150H415 M565 150H620V70"
                  stroke="#7b8ca4"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#bpmn-arrow)"
                />
                <circle cx="45" cy="70" r="18" fill="#e2f4f4" stroke="#087c72" strokeWidth="2" />
                <rect x="100" y="36" width="145" height="68" rx="8" fill="white" stroke="#1b7093" />
                <path d="M330 45L355 70L330 95L305 70Z" fill="#fff5de" stroke="#b57519" />
                <rect x="415" y="36" width="150" height="68" rx="8" fill="white" stroke="#1b7093" />
                <rect
                  x="415"
                  y="123"
                  width="150"
                  height="54"
                  rx="8"
                  fill="white"
                  stroke="#7b8ca4"
                />
                <circle cx="701" cy="70" r="18" fill="#e2f4f4" stroke="#087c72" strokeWidth="4" />
                <g fill="#20334e" fontSize="13" textAnchor="middle">
                  <text x="172" y="67">
                    Realizar
                  </text>
                  <text x="172" y="85">
                    triagem
                  </text>
                  <text x="490" y="67">
                    Executar e
                  </text>
                  <text x="490" y="85">
                    validar entrega
                  </text>
                  <text x="490" y="155">
                    Pedir complemento
                  </text>
                  <text x="330" y="26">
                    Completa?
                  </text>
                  <text x="382" y="60">
                    Sim
                  </text>
                  <text x="350" y="127">
                    Não
                  </text>
                  <text x="45" y="115">
                    Receber
                  </text>
                  <text x="701" y="115">
                    Concluir
                  </text>
                </g>
              </svg>
            </div>
          )}
          {selected === 2 && (
            <div className="raci-example">
              <table>
                <caption className="sr-only">Matriz RACI ilustrativa do atendimento</caption>
                <thead>
                  <tr>
                    {['Atividade', 'Operações', 'Liderança', 'Cliente'].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Realizar triagem', 'R', 'A', 'C'],
                    ['Validar entrega', 'R', 'A', 'C'],
                    ['Concluir solicitação', 'R', 'A', 'I'],
                  ].map(([label, ...roles]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {roles.map((role, i) => (
                        <td key={i}>
                          <span data-role={role}>{role}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>R · Responsável &nbsp; A · Aprovador &nbsp; C · Consultado &nbsp; I · Informado</p>
            </div>
          )}
        </div>
        <div className="process-caption">
          <span>
            <FileCheck2 size={15} aria-hidden="true" /> Atendimento de solicitações
          </span>
          <span>Exemplo ilustrativo · dados fictícios</span>
        </div>
      </div>
    </div>
  );
}

export function ModuleExplorer() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="module-explorer">
      <div className="module-tabs" role="tablist" aria-label="Grupos de módulos">
        {productGroups.map((group, i) => (
          <button
            key={group.id}
            id={`module-tab-${i}`}
            role="tab"
            aria-selected={selected === i}
            aria-controls="module-panel"
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => navigateTabs(event, i, productGroups.length, setSelected)}
          >
            <span>0{i + 1}</span>
            {group.label}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div
        id="module-panel"
        role="tabpanel"
        aria-labelledby={`module-tab-${selected}`}
        tabIndex={0}
        className="module-panel"
      >
        <p className="module-group-description">{productGroups[selected].description}</p>
        {activeProductModules
          .filter((module) => module.group === productGroups[selected].id)
          .map((module) => (
            <article key={module.slug}>
              <span className="public-eyebrow">{module.eyebrow}</span>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <ul>
                {module.capabilities.map((capability) => (
                  <li key={capability}>
                    <Check size={15} aria-hidden="true" />
                    {capability}
                  </li>
                ))}
              </ul>
              <Link href={module.href} className="public-text-link">
                Explorar <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
      </div>
    </div>
  );
}

const analysisMethods = [
  {
    name: 'Ishikawa',
    title: 'Organize as hipóteses.',
    text: 'Explore possíveis causas por categoria antes de concluir a investigação.',
  },
  {
    name: '5 Porquês',
    title: 'Aprofunde a investigação.',
    text: 'Use perguntas encadeadas para sair do sintoma e investigar a causa.',
  },
  {
    name: '5W2H',
    title: 'Dê clareza ao plano.',
    text: 'Defina o que será feito, por quem, quando, onde, por quê, como e com qual custo.',
  },
  {
    name: 'PDCA',
    title: 'Acompanhe o ciclo de melhoria.',
    text: 'Planeje, execute, verifique e ajuste com base no que foi observado.',
  },
];

export function ImprovementWorkbench() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="analysis-workbench">
      <div className="analysis-tabs" role="tablist" aria-label="Ferramentas de análise e melhoria">
        {analysisMethods.map((method, i) => (
          <button
            key={method.name}
            id={`analysis-tab-${i}`}
            role="tab"
            aria-selected={selected === i}
            aria-controls="analysis-panel"
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => navigateTabs(event, i, 4, setSelected)}
          >
            {method.name}
          </button>
        ))}
      </div>
      <div
        id="analysis-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`analysis-tab-${selected}`}
        className="analysis-panel"
      >
        <div className="analysis-intro">
          <span className="public-eyebrow">{analysisMethods[selected].name}</span>
          <h3>{analysisMethods[selected].title}</h3>
          <p>{analysisMethods[selected].text}</p>
          <small>Exemplo ilustrativo · Atendimento de solicitações</small>
        </div>
        <div className="analysis-visual">
          {selected === 0 && (
            <svg
              viewBox="0 0 540 220"
              role="img"
              aria-label="Diagrama de Ishikawa ilustrativo para investigar entregas fora do SLA, com hipóteses em método, pessoas, informação e medição"
            >
              <path
                d="M30 110H395 M95 35L170 110 M255 35L330 110 M95 185L170 110 M255 185L330 110"
                stroke="#8197ab"
                strokeWidth="1.5"
                fill="none"
              />
              <rect x="395" y="78" width="135" height="64" rx="6" fill="#edf5f8" stroke="#5d9bb0" />
              <g fontFamily="inherit" fill="#294a64" fontSize="12">
                <text x="55" y="25">
                  Método
                </text>
                <text x="225" y="25">
                  Pessoas
                </text>
                <text x="55" y="210">
                  Informação
                </text>
                <text x="225" y="210">
                  Medição
                </text>
                <text x="463" y="104" textAnchor="middle">
                  Entregas fora
                </text>
                <text x="463" y="123" textAnchor="middle">
                  do SLA
                </text>
              </g>
              <g fontFamily="inherit" fill="#697e92" fontSize="10">
                <text x="25" y="64">
                  Triagem sem padrão
                </text>
                <text x="210" y="64">
                  Atribuição indefinida
                </text>
                <text x="25" y="162">
                  Requisito incompleto
                </text>
                <text x="225" y="162">
                  Registro tardio
                </text>
              </g>
            </svg>
          )}
          {selected === 1 && <SampleVisual step={4} />}
          {selected === 2 && (
            <dl className="analysis-5w2h">
              {[
                ['O quê', 'Padronizar a triagem'],
                ['Por quê', 'Orientar o encaminhamento'],
                ['Quem', 'Equipe de operações'],
                ['Quando', 'Próxima revisão mensal'],
                ['Onde', 'Processo de atendimento'],
                ['Como', 'Revisar o procedimento'],
                ['Quanto', 'Esforço a estimar no plano'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {selected === 3 && (
            <div className="analysis-pdca">
              {[
                ['P', 'Planejar', 'Investigar e definir o plano'],
                ['D', 'Executar', 'Realizar e registrar evidências'],
                ['C', 'Verificar', 'Avaliar resultados e eficácia'],
                ['A', 'Agir', 'Ajustar ou padronizar'],
              ].map(([letter, title, text]) => (
                <div key={letter}>
                  <span>{letter}</span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProjectCurve() {
  return (
    <div className="project-curve">
      <div className="project-curve-heading">
        <div>
          <span className="sample-kicker">PROJETO DE MELHORIA</span>
          <h3>Avanço que pode ser acompanhado.</h3>
        </div>
        <TrendingUp size={24} aria-hidden="true" />
      </div>
      <div className="curve-legend">
        <span>
          <i /> Planejado
        </span>
        <span>
          <i /> Realizado
        </span>
      </div>
      <svg
        viewBox="0 0 560 210"
        role="img"
        aria-label="Curva S ilustrativa comparando o progresso planejado e realizado até a medição atual"
      >
        <g stroke="#33445e" fill="none">
          <path d="M35 20H535M35 70H535M35 120H535M35 170H535" />
        </g>
        <g fill="#a8b8ce" fontSize="11">
          <text x="0" y="24">
            100%
          </text>
          <text x="6" y="74">
            75%
          </text>
          <text x="6" y="124">
            50%
          </text>
          <text x="6" y="174">
            25%
          </text>
          <text x="35" y="202">
            Início
          </text>
          <text x="252" y="202">
            Medição atual
          </text>
          <text x="508" y="202">
            Fim
          </text>
        </g>
        <path
          d="M35 185C120 180 150 160 210 125S320 40 535 20"
          fill="none"
          stroke="#7dd3e8"
          strokeWidth="3"
          strokeDasharray="6 5"
        />
        <path
          d="M35 185C115 180 155 171 205 145S245 109 285 92"
          fill="none"
          stroke="#4dd9b3"
          strokeWidth="4"
        />
        <circle cx="285" cy="92" r="5" fill="#4dd9b3" />
        <path d="M285 30V175" stroke="#6c809b" strokeDasharray="3 5" />
      </svg>
      <div className="project-curve-footer">
        <span>
          <CheckCircle2 size={15} aria-hidden="true" /> Medições registradas
        </span>
        <span>Dados ilustrativos</span>
      </div>
    </div>
  );
}
