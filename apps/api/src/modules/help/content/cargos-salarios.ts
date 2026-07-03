import { HelpCatalogCategory } from './types';

export const cargosSalarios: HelpCatalogCategory = {
  slug: 'cargos-salarios',
  title: 'Cargos e Salários',
  description: 'Catálogo de cargos, tabelas salariais, movimentações, mérito e equidade.',
  icon: 'Briefcase',
  position: 7,
  articles: [
    {
      slug: 'cargos-salarios-visao-geral',
      title: 'Cargos e Salários: visão geral',
      summary: 'A suíte de remuneração: estrutura, faixas, movimentações e governança.',
      tags: ['cargos e salarios', 'remuneracao', 'rh', 'salario', 'compensation'],
      body: `O módulo **Cargos e Salários** é uma suíte completa de gestão de remuneração:

- **Visão Geral** — painel com os indicadores de remuneração;
- **Estrutura e Quadro** — estrutura organizacional e quadro de pessoal;
- **Catálogo de Cargos** — famílias e cargos com versionamento;
- **Descrições** — descrições de cargo com aprovação e exportação em Word;
- **Tabelas Salariais** — tabelas, faixas e referências versionadas;
- **Enquadramento** — posição de cada colaborador na faixa (compa-ratio);
- **Movimentações** — promoções e reajustes com fluxo de aprovação;
- **Ciclos de Mérito** — revisões salariais organizadas;
- **Orçamento de Pessoal** — orçamento e simulações de folha;
- **Pesquisas Salariais** — benchmark de mercado;
- **Simulações** — cenários salariais;
- **Equidade** — análise de equidade salarial (Lei 14.611);
- **Relatórios** e trilha de auditoria.

## Sequência de implantação recomendada
1. Catálogo de cargos e descrições → 2. Tabelas salariais com faixas → 3. Enquadramento do quadro → 4. Movimentações e mérito → 5. Orçamento, pesquisas e simulações.`,
    },
    {
      slug: 'catalogo-e-descricoes-de-cargo',
      title: 'Catálogo de cargos e descrições',
      summary: 'Cadastre cargos versionados e gere descrições em Word com aprovação.',
      tags: ['cargo', 'descricao de cargo', 'catalogo', 'funcao', 'docx'],
      body: `## Catálogo de Cargos
- Organize os cargos por **famílias** (ex.: Operações, Administrativo, Comercial);
- Cada cargo tem **versões** — mudanças criam versão nova, preservando o histórico;
- Ações: criar, editar, **duplicar**, inativar/reativar.

## Descrições de cargo
1. Crie a **descrição** do cargo: missão, responsabilidades, requisitos, competências, formação e experiência.
2. Envie para **aprovação** — o fluxo registra quem aprovou.
3. **Exporte em Word (DOCX)** ou gere o documento oficial — a descrição pode virar documento controlado no GED.

## Boas práticas
- Vincule cada colaborador ao cargo correto (base para enquadramento e prêmio);
- Revise as descrições quando o cargo mudar — o versionamento mostra a evolução;
- Descrições atualizadas são exigidas em auditorias trabalhistas e certificações.`,
    },
    {
      slug: 'tabelas-salariais-e-enquadramento',
      title: 'Tabelas salariais, faixas e enquadramento (compa-ratio)',
      summary: 'Estruture faixas salariais e veja a posição de cada colaborador nelas.',
      tags: ['tabela salarial', 'faixa', 'enquadramento', 'compa-ratio', 'steps', 'referencia'],
      body: `## Tabelas salariais
1. Crie a **tabela salarial** e defina as **faixas** (grades) com valores mínimo, médio e máximo — e referências/steps quando usar;
2. **Publique** a tabela para ela valer; revisões criam **nova versão** (ex.: após dissídio).

## Enquadramento
A tela de **Enquadramento** cruza o salário real de cada colaborador com a faixa do seu cargo e calcula o **compa-ratio**:
- **Compa-ratio = salário ÷ ponto médio da faixa**;
- Abaixo de 0,8: colaborador abaixo da faixa (risco de perda);
- Entre 0,8 e 1,2: dentro da faixa;
- Acima de 1,2: acima da faixa (atenção ao orçamento).

## Para que serve
- Identificar **desalinhamentos** (quem está fora da faixa);
- Priorizar correções nos **ciclos de mérito**;
- Sustentar a política salarial com critério técnico, não caso a caso.`,
    },
    {
      slug: 'movimentacoes-e-ciclos-de-merito',
      title: 'Movimentações e ciclos de mérito',
      summary: 'Promoções e reajustes com aprovação; revisões salariais organizadas.',
      tags: ['movimentacao', 'promocao', 'reajuste', 'merito', 'aprovacao', 'aumento'],
      body: `## Movimentações
Toda alteração salarial ou de cargo passa por uma **movimentação**:
1. Registre o tipo (promoção, mérito, reajuste, transferência), o valor/percentual e a justificativa;
2. A movimentação segue para **aprovação** (aparece na central de Aprovações do aprovador);
3. Aprovada, é **aplicada** — o histórico fica completo: quem pediu, quem aprovou, quando valeu.

## Ciclos de mérito
Organize as revisões salariais em **ciclos** (ex.: ciclo anual):
- Defina o período e o orçamento do ciclo;
- Distribua os méritos considerando desempenho (distribuição de ratings) e posição na faixa (compa-ratio);
- Acompanhe o consumo do orçamento durante as decisões.

## Governança
Nada muda "por fora": sem movimentação aprovada não há alteração — e a trilha de auditoria registra tudo.`,
    },
    {
      slug: 'equidade-salarial-lei-14611',
      title: 'Equidade salarial (Lei 14.611) e Relatório de Transparência',
      summary: 'Analise diferenças salariais por gênero e gere o relatório exigido por lei.',
      tags: ['equidade', 'lei 14611', 'transparencia', 'genero', 'igualdade salarial', 'relatorio'],
      body: `A tela **Equidade** (Cargos e Salários > Equidade) atende à **Lei 14.611/2023** (igualdade salarial):

## O que faz
- Compara a remuneração por **gênero** dentro de cargos e faixas comparáveis;
- Mostra as **diferenças percentuais** e onde estão as maiores distorções;
- Usa o **perfil complementar do colaborador** (dados demográficos importáveis por planilha) para os recortes;
- Gera o **Relatório de Transparência Salarial** — o documento semestral exigido para empresas com 100+ funcionários.

## Como usar
1. Importe/complete os **perfis dos colaboradores** (CSV/XLSX);
2. Analise os recortes de equidade por cargo/faixa;
3. Trate as distorções via **movimentações** e ciclos de mérito;
4. Gere o relatório para publicação.

Além da obrigação legal, a análise protege a empresa de passivos e sustenta uma política salarial justa.`,
    },
    {
      slug: 'orcamento-pesquisas-simulacoes',
      title: 'Orçamento de pessoal, pesquisas salariais e simulações',
      summary: 'Planeje a folha, compare com o mercado e simule cenários antes de decidir.',
      tags: ['orcamento', 'folha', 'pesquisa salarial', 'benchmark', 'simulacao', 'cenario'],
      body: `## Orçamento de pessoal
Monte o **orçamento de folha** do período: base atual + movimentações previstas + encargos. Acompanhe o realizado contra o orçado durante o ano.

## Pesquisas salariais (benchmark)
Importe **pesquisas de mercado** e compare suas faixas com os percentis de mercado (P25/P50/P75) — sustenta decisões de ajuste de tabela com dado, não opinião.

## Simulações
Antes de decidir, **simule cenários**: "e se aplicarmos 6% na tabela?", "e se promovermos este grupo?" — o sistema calcula o impacto total na folha. Simulações relevantes podem seguir para **aprovação** formal.

## Fluxo recomendado no ciclo anual
1. Pesquisa de mercado → 2. Simulação de ajuste de tabela → 3. Aprovação → 4. Nova versão da tabela → 5. Movimentações/mérito dentro do orçamento.`,
    },
  ],
};
