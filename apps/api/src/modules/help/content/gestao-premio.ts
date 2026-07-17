import { HelpCatalogCategory } from './types';

export const gestaoPremio: HelpCatalogCategory = {
  slug: 'gestao-premio',
  title: 'Gestão de Prêmio',
  description: 'Remuneração variável: regras, competências, apuração, espelhos e folha.',
  icon: 'Award',
  position: 10,
  articles: [
    {
      slug: 'gestao-premio-visao-geral',
      title: 'Gestão de Prêmio: visão geral da remuneração variável',
      summary: 'O ciclo completo do PLR/bônus: das regras à folha de pagamento.',
      tags: ['premio', 'plr', 'bonus', 'remuneracao variavel', 'apuracao'],
      body: `O módulo **Gestão de Prêmio** faz toda a remuneração variável (PLR, bônus, prêmio por desempenho) de ponta a ponta, substituindo as planilhas de cálculo.

## O ciclo mensal
1. **Regras** — desenhe o programa nos **Anexos** (versionados e aprovados): indicadores, pesos, faixas e a **matriz área × cargo**;
2. **Competência** — abra a competência do mês;
3. **Base elegível** — carregue os colaboradores elegíveis (importação ou conector de RH), com atestados e eventos;
4. **Realizado** — sincronize os resultados dos indicadores (Previsto × Realizado);
5. **Apuração** — rode o motor de cálculo; revise a **memória de cálculo**; aplique ajustes/exceções; aprove;
6. **Espelhos** — publique o demonstrativo individual; o colaborador dá **ciência**;
7. **Folha** — gere o lote para a folha de pagamento, exporte e registre o retorno.

## Por que é melhor que planilha
- Cálculo **auditável** com memória de como cada valor foi obtido;
- O colaborador **entende** o próprio prêmio (espelho transparente);
- Trilha de auditoria completa e fluxo de aprovação em cada etapa.`,
    },
    {
      slug: 'premio-regras-anexos-competencias',
      title: 'Regras do prêmio: anexos, indicadores e matriz área × cargo',
      summary: 'Como desenhar e versionar as regras da remuneração variável.',
      tags: ['anexo', 'regras', 'matriz', 'faixas', 'indicadores do premio', 'competencia'],
      body: `## Anexos (governança das regras)
As regras vivem em **Anexos versionados**: cada mudança cria uma versão que passa por **submissão → aprovação → publicação**. Dá para **comparar versões** e ver quem aprovou o quê — a regra vigente nunca é ambígua.

## Indicadores do prêmio
Cadastre os **indicadores que pagam prêmio** com seus **parâmetros** e **faixas (ranges)**: cada faixa de atingimento corresponde a um percentual de prêmio. Há sugestão automática de faixas e carga em lote.

## Regras em matriz (área × cargo)
A matriz define **quais indicadores valem para cada combinação de área e cargo**, com pesos:
- **Catálogo e grupos** organizam os indicadores;
- As **células** da matriz ligam área × cargo aos indicadores;
- **Não casados (unmatched)** mostra colaboradores que não caíram em nenhuma célula — trate com **aliases (de-para)** de área/cargo.

## Competências
A **competência** é o ciclo mensal: abertura → validação (checklist) → apuração → **fechamento** (com reabertura controlada quando necessário).`,
    },
    {
      slug: 'premio-apuracao-memoria-calculo',
      title: 'Apuração e memória de cálculo',
      summary: 'Rode o motor, entenda cada valor e trate ajustes e exceções.',
      tags: ['apuracao', 'calculo', 'memoria de calculo', 'ajuste', 'excecao', 'aprovar apuracao'],
      body: `## Rodar a apuração
1. Com a base elegível e o realizado carregados, vá em **Apuração** e **rode o cálculo** da competência;
2. O motor aplica as regras da matriz: para cada colaborador, os indicadores da sua célula (área × cargo), os pesos, as faixas de atingimento e os **moderadores** (fatores como frequência);
3. Reprocesse quando necessário (ex.: correção de resultado de indicador).

## Memória de cálculo
Cada resultado tem a **memória de cálculo**: passo a passo de como o valor foi obtido — indicador por indicador, peso por peso. É o que acaba com a disputa "de onde saiu esse número?".

## Ajustes e exceções
- **Ajustes manuais** — correções pontuais com justificativa e decisão registrada;
- **Exceções** — tratamentos fora da regra (ex.: afastamento) com governança.

## Aprovação
A apuração vai para **revisão e aprovação** antes de liberar os espelhos. Relatórios de apuração e operacional (com exportação) apoiam a conferência — e há resumo por IA da competência.`,
    },
    {
      slug: 'premio-espelhos-e-folha',
      title: 'Espelhos do prêmio e integração com a folha',
      summary: 'Publique o demonstrativo individual com ciência e gere o lote da folha.',
      tags: ['espelho', 'payslip', 'ciencia', 'folha', 'lote', 'pagamento'],
      body: `## Espelhos (demonstrativo individual)
1. Com a apuração aprovada, **gere os espelhos** da competência;
2. **Publique** — cada colaborador vê seu demonstrativo: indicadores, atingimentos, pesos e o valor final;
3. O colaborador dá **ciência** no espelho — registro de que viu e entendeu.

Transparência reduz drasticamente questionamentos e passivos.

## Integração com a folha
1. **Gere o lote da folha** da competência — os valores consolidados por colaborador;
2. **Exporte** o arquivo no layout da folha;
3. Marque como **enviado** e depois registre o **retorno** da folha (confirmação do processamento);
4. Se necessário, **cancele** um lote antes do envio.

O ciclo fecha com rastreabilidade completa: regra publicada → apuração aprovada → espelho com ciência → lote pago.`,
    },
  ],
};
