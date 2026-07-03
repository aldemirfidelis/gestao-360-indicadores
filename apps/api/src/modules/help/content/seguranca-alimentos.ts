import { HelpCatalogCategory } from './types';

export const segurancaAlimentos: HelpCatalogCategory = {
  slug: 'seguranca-alimentos',
  title: 'Segurança dos Alimentos',
  description: 'APPCC, fluxograma de processo, monitoramento de PCC, rastreabilidade e recall.',
  icon: 'Utensils',
  position: 5,
  articles: [
    {
      slug: 'seguranca-alimentos-visao-geral',
      title: 'Segurança dos Alimentos: visão geral (FSMS/APPCC)',
      summary: 'O sistema de gestão de segurança de alimentos completo e integrado.',
      tags: ['seguranca dos alimentos', 'fsms', 'appcc', 'haccp', 'iso 22000', 'alimentos'],
      body: `O módulo **Segurança dos Alimentos** é um FSMS (Sistema de Gestão de Segurança de Alimentos) completo, alinhado a ISO 22000 / FSSC 22000 / APPCC — para indústrias de alimentos e bebidas.

## O que cobre
- **Programa** — o FSMS da unidade (escopo, dono, status);
- **Fluxograma de processo** — as etapas da produção, inclusive em visualização 3D;
- **Perigos (APPCC)** — análise de perigos com matriz de risco;
- **Monitoramento** — planos de controle com limites críticos e bloqueio de lote;
- **Compliance** — normas, requisitos e avaliações;
- **Cadeia e Recall** — fornecedores, materiais, lotes, rastreabilidade e recolhimento;
- **Inteligência** — painel com scorecard de fornecedores e insights por IA.

## Como começar
1. Crie o **Programa** da unidade.
2. Mapeie o **processo/fluxograma** de produção.
3. Faça a **análise de perigos** e classifique PCC/PPRO.
4. Defina **planos de controle** e registre o monitoramento.
5. Cadastre normas e avalie o **compliance**.
6. Gerencie a **cadeia** (fornecedores, lotes) e esteja pronto para **recall**.`,
    },
    {
      slug: 'fluxograma-de-processo-3d',
      title: 'Fluxograma de processo (3D): montar, arrastar e salvar modelos',
      summary: 'Monte o fluxo da produção em blocos 3D, reposicione e reutilize modelos.',
      tags: ['fluxograma', '3d', 'blocos', 'arrastar', 'etapas', 'processo', 'modelo de fluxo'],
      body: `Na aba de fluxograma da Segurança dos Alimentos você monta o processo produtivo em uma **visualização 3D isométrica**.

## Montar o fluxo
1. Adicione **etapas/blocos** — cada bloco representa uma etapa tipada (Recebimento, Armazenamento, Processamento, Envase, Transporte, Distribuição), com indicação de ponto de controle.
2. **Arraste os blocos** com o mouse para posicioná-los onde quiser: clique no bloco e mova segurando o botão — a câmera pausa durante o arraste e o cursor viram "mãozinha".
3. Use o botão direito/scroll para orbitar e dar zoom na cena.

## Salvar e reutilizar modelos
- **Salvar como modelo** — guarda o desenho do fluxo para reutilizar em outros processos ou unidades;
- **Importar/exportar** — leve fluxos entre ambientes ou compartilhe com outra planta.

## Conexão com a APPCC
As etapas do fluxograma são a base da **análise de perigos**: cada perigo é associado a uma etapa do processo, e os pontos de controle (PCC) ficam sinalizados no fluxo.`,
    },
    {
      slug: 'perigos-appcc-e-monitoramento',
      title: 'Perigos (APPCC) e monitoramento de PCC',
      summary: 'Análise de perigos, limites críticos e bloqueio automático de lote.',
      tags: ['perigo', 'pcc', 'prp', 'oprp', 'monitoramento', 'limite critico', 'bloqueio de lote'],
      body: `## Análise de perigos
1. Configure a **matriz de risco** do programa.
2. Cadastre os **perigos** por etapa do processo: categoria (**Biológico, Químico, Físico, Alergênico**), severidade × probabilidade (o sistema calcula índice e nível) e o **tipo de controle**: PRP, OPRP ou **PCC**.
3. Registre os controles existentes.

## Planos de controle (monitoramento)
Para cada ponto de controle, defina:
- **Parâmetro** medido (temperatura, pH, tempo, metais…);
- **Limites críticos** e **limites de alerta**;
- Método, instrumento e **frequência** de medição;
- **Ação corretiva** em caso de desvio;
- Se o desvio **bloqueia o lote** e/ou **exige NC**.

## Registros de monitoramento
Cada medição registra o valor e o resultado: **OK / Alerta / Fora**. Quando o valor sai do limite crítico:
- O **lote é bloqueado automaticamente** (entra em quarentena), se configurado;
- Pode abrir **Não Conformidade** automaticamente;
- A ação corretiva definida orienta o operador na hora.

Assim, nenhum desvio de PCC passa despercebido — e há prova de monitoramento para o auditor.`,
    },
    {
      slug: 'cadeia-rastreabilidade-recall',
      title: 'Cadeia de suprimentos, rastreabilidade e recall',
      summary: 'Fornecedores com score, lotes encadeados e recolhimento em minutos.',
      tags: ['rastreabilidade', 'recall', 'lote', 'fornecedor', 'material', 'quarentena', 'cadeia'],
      body: `## Fornecedores e materiais
- Cadastre **fornecedores** (com **score** de desempenho e auditorias) e **materiais**;
- O **scorecard de fornecedores** na aba Inteligência prioriza quem precisa de atenção.

## Lotes e rastreabilidade
- Registre **lotes** recebidos e produzidos, com status **Liberado** ou **Quarentena**;
- Os **vínculos de rastreabilidade** encadeiam os lotes: qual lote de matéria-prima entrou em qual lote produzido (produção, transferência, consumo);
- A consulta de **rastreabilidade do lote** mostra toda a cadeia — para frente e para trás.

## Recall
Em um incidente:
1. Abra um **recall** informando o motivo e o lote afetado;
2. O sistema levanta, pela rastreabilidade, **todos os lotes relacionados** — adicione-os como itens do recall;
3. Gerencie o recolhimento item a item até o encerramento.

O que levava dias em planilhas sai **em minutos**, com registro completo para a vigilância sanitária.`,
    },
    {
      slug: 'compliance-normativo-fsms',
      title: 'Compliance normativo (ISO 22000 e outros)',
      summary: 'Normas, requisitos e avaliações de atendimento com evidência.',
      tags: ['compliance', 'norma', 'requisito', 'iso 22000', 'fssc', 'avaliacao'],
      body: `A aba **Compliance** da Segurança dos Alimentos acompanha o atendimento a normas:

1. Cadastre as **normas** e suas **versões** (ex.: ISO 22000:2018, FSSC 22000);
2. Registre os **requisitos** de cada norma;
3. **Avalie** cada requisito: **Atende / Parcial / Não atende**, com **evidência** e data da **próxima avaliação**;
4. Acompanhe o **resumo de compliance** — o percentual de atendimento por norma.

## Dicas
- Requisitos "Não atende" devem gerar **plano de ação** ou **NC** para tratamento;
- Use as datas de próxima avaliação como agenda viva de manutenção do sistema;
- Na auditoria de certificação, o resumo + evidências substituem a caça a documentos.`,
    },
  ],
};
