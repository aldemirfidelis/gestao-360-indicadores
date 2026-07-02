import { DocumentType } from '@prisma/client';

/**
 * Biblioteca de modelos prontos do GED.
 *
 * Cada entrada e um "starter" profissional que a empresa instala com um
 * clique (vira um DocumentTemplate proprio, editavel). O conteudo usa o
 * markdown enxuto suportado por docx.util (titulos #, tabelas |, negrito
 * ** e divisores ---) e os placeholders oficiais do modulo, resolvidos na
 * criacao do documento.
 */

export interface LibraryTemplate {
  key: string;
  name: string;
  description: string;
  category: DocumentType;
  /** Sigla do tipo documental (DocumentTypeConfig) a vincular, quando existir. */
  sigla: string | null;
  content: string;
}

const HEADER = [
  '| {{company_name}} | {{document_code}} |',
  '| {{document_title}} | Revisão: {{revision}} |',
  '',
  '**Unidade/Área:** {{unit_name}} / {{area_name}}',
  '**Elaborado por:** {{author_name}} | **Responsável:** {{responsible_name}} | **Aprovado por:** {{approver_name}}',
  '**Publicação:** {{publication_date}} | **Validade:** {{expiration_date}}',
  '',
  '---',
  '',
].join('\n');

const FOOTER = [
  '',
  '---',
  '',
  '# Histórico de Revisões',
  '',
  '| Revisão | Data | Descrição da alteração | Responsável |',
  '|---|---|---|---|',
  '| {{revision}} | {{publication_date}} | Emissão | {{author_name}} |',
].join('\n');

export const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  {
    key: 'pop',
    name: 'Procedimento Operacional Padrão (POP)',
    description: 'Estrutura completa de POP: objetivo, aplicação, responsabilidades, descrição das atividades, recursos e registros.',
    category: DocumentType.PROCEDURE,
    sigla: 'PRO',
    content: `${HEADER}# 1. Objetivo

Descrever o padrão para execução de [atividade/processo], garantindo segurança, qualidade e repetibilidade.

# 2. Aplicação

Este procedimento aplica-se a [áreas/funções abrangidas].

# 3. Documentos de Referência

- [Norma/legislação aplicável]
- [Documentos internos relacionados]

# 4. Definições

- **[Termo]:** [definição]

# 5. Responsabilidades

| Função | Responsabilidade |
|---|---|
| [Cargo/função] | [O que executa/garante] |
| [Cargo/função] | [O que executa/garante] |

# 6. Descrição das Atividades

## 6.1 [Etapa 1]

[Descreva o passo a passo, parâmetros, limites e critérios de aceitação.]

## 6.2 [Etapa 2]

[Descreva o passo a passo.]

# 7. Recursos Necessários

- [Equipamentos, EPIs, materiais e sistemas]

# 8. Controle de Desvios

[O que fazer quando o padrão não puder ser cumprido: registro, comunicação e disposição.]

# 9. Registros

| Registro | Onde é mantido | Retenção |
|---|---|---|
| [Nome do registro] | [Local/sistema] | [Prazo] |
${FOOTER}`,
  },
  {
    key: 'instrucao-trabalho',
    name: 'Instrução de Trabalho (IT)',
    description: 'Passo a passo operacional direto ao ponto, com segurança, materiais e pontos de atenção.',
    category: DocumentType.INSTRUCTION,
    sigla: 'IT',
    content: `${HEADER}# 1. Objetivo

Orientar a execução de [tarefa específica] de forma padronizada.

# 2. Segurança

- **EPIs obrigatórios:** [listar]
- **Riscos da tarefa:** [listar riscos e cuidados]

# 3. Materiais e Ferramentas

- [Item 1]
- [Item 2]

# 4. Passo a Passo

## Passo 1 - [Título]

[Descrição objetiva da ação. Inclua fotos/figuras quando aplicável.]

## Passo 2 - [Título]

[Descrição objetiva da ação.]

## Passo 3 - [Título]

[Descrição objetiva da ação.]

# 5. Pontos de Atenção

- **Nunca** [ação proibida].
- **Sempre** [ação obrigatória].

# 6. Em Caso de Anormalidade

[Quem acionar e como registrar.]
${FOOTER}`,
  },
  {
    key: 'politica',
    name: 'Política Corporativa',
    description: 'Modelo para políticas: propósito, abrangência, diretrizes, papéis, conformidade e vigência.',
    category: DocumentType.POLICY,
    sigla: 'POL',
    content: `${HEADER}# 1. Propósito

Estabelecer as diretrizes de [tema da política] para {{company_name}}.

# 2. Abrangência

Esta política aplica-se a [todos os colaboradores/unidades/terceiros].

# 3. Diretrizes

## 3.1 [Diretriz 1]

[Enunciado claro da regra ou compromisso.]

## 3.2 [Diretriz 2]

[Enunciado claro da regra ou compromisso.]

# 4. Papéis e Responsabilidades

| Papel | Responsabilidade |
|---|---|
| Alta Direção | Prover recursos e patrocinar a política |
| Gestores | Garantir a aplicação nas suas áreas |
| Colaboradores | Cumprir as diretrizes estabelecidas |

# 5. Conformidade e Sanções

O descumprimento desta política sujeita o infrator às medidas disciplinares previstas em [regulamento interno], sem prejuízo das sanções legais.

# 6. Vigência e Revisão

Esta política entra em vigor na data de publicação e será revisada a cada [12/24] meses ou quando houver mudança relevante.
${FOOTER}`,
  },
  {
    key: 'manual',
    name: 'Manual de Gestão',
    description: 'Estrutura de manual: apresentação, escopo, processos, organograma e anexos.',
    category: DocumentType.MANUAL,
    sigla: 'MAN',
    content: `${HEADER}# 1. Apresentação

[Contextualize o manual, seu propósito e a quem se destina.]

# 2. Escopo

[Delimite unidades, processos e requisitos cobertos.]

# 3. Termos e Definições

- **[Termo]:** [definição]

# 4. Estrutura Organizacional

[Descreva a estrutura, comitês e fóruns de gestão. Referencie o organograma vigente.]

# 5. Processos

## 5.1 [Macroprocesso 1]

[Objetivo, entradas, saídas e indicadores.]

## 5.2 [Macroprocesso 2]

[Objetivo, entradas, saídas e indicadores.]

# 6. Documentação Relacionada

| Código | Documento | Relação |
|---|---|---|
| [COD-000] | [Título] | [Como se relaciona] |

# 7. Anexos

- Anexo A - [Título]
${FOOTER}`,
  },
  {
    key: 'formulario-registro',
    name: 'Formulário de Registro',
    description: 'Formulário com campos de identificação, tabela de coleta e assinaturas.',
    category: DocumentType.FORM,
    sigla: 'FOR',
    content: `${HEADER}# Identificação

| Campo | Preenchimento |
|---|---|
| Data | ___/___/______ |
| Turno | [ ] 1º [ ] 2º [ ] 3º |
| Setor/Linha | ______________________ |
| Responsável | ______________________ |

# Registro

| Item verificado | Especificação | Resultado | Conforme? | Observação |
|---|---|---|---|---|
| | | | [ ] Sim [ ] Não | |
| | | | [ ] Sim [ ] Não | |
| | | | [ ] Sim [ ] Não | |
| | | | [ ] Sim [ ] Não | |

# Tratamento de Não Conformidades

| Item | Ação imediata | Responsável | Prazo |
|---|---|---|---|
| | | | |

# Assinaturas

| Executante | Verificador |
|---|---|
| | |
${FOOTER}`,
  },
  {
    key: 'ata-reuniao',
    name: 'Ata de Reunião',
    description: 'Ata com pauta, participantes, deliberações e plano de ação.',
    category: DocumentType.RECORD,
    sigla: 'REG',
    content: `${HEADER}# Dados da Reunião

| Campo | Informação |
|---|---|
| Data e hora | |
| Local / sala virtual | |
| Facilitador | |
| Secretário(a) | |

# Participantes

| Nome | Área | Presente? |
|---|---|---|
| | | [ ] Sim [ ] Não |
| | | [ ] Sim [ ] Não |

# Pauta

- [Item 1]
- [Item 2]

# Deliberações

## [Item 1]

[Discussão e decisão tomada.]

# Plano de Ação

| Ação | Responsável | Prazo | Status |
|---|---|---|---|
| | | | |

# Próxima Reunião

[Data, hora e pauta prevista.]
${FOOTER}`,
  },
  {
    key: 'plano-appcc',
    name: 'Plano APPCC / HACCP',
    description: 'Plano de segurança de alimentos: equipe, descrição do produto, fluxograma, análise de perigos e PCCs.',
    category: DocumentType.PLAN,
    sigla: 'PRO',
    content: `${HEADER}# 1. Equipe de Segurança de Alimentos

| Nome | Função na equipe | Área |
|---|---|---|
| | Coordenador | |
| | Membro | |

# 2. Descrição do Produto

| Característica | Descrição |
|---|---|
| Nome do produto | |
| Composição | |
| Características físico-químicas | |
| Embalagem | |
| Validade e conservação | |
| Uso pretendido / público | |

# 3. Fluxograma do Processo

[Referencie o fluxograma aprovado no módulo Segurança dos Alimentos ou anexe a versão vigente.]

# 4. Análise de Perigos

| Etapa | Perigo (B/Q/F/A) | Justificativa | Probabilidade | Severidade | Medida de controle |
|---|---|---|---|---|---|
| | | | | | |

# 5. Determinação de PCC / PPRO

| Etapa | Perigo | Q1 | Q2 | Q3 | Q4 | PCC/PPRO? |
|---|---|---|---|---|---|---|
| | | | | | | |

# 6. Plano de Monitoramento dos PCCs

| PCC | Limite crítico | O que monitorar | Como | Frequência | Responsável | Ação corretiva |
|---|---|---|---|---|---|---|
| | | | | | | |

# 7. Verificação e Validação

[Atividades de verificação (calibração, auditoria, análise de registros) e validação das medidas de controle.]

# 8. Registros Associados

- [Planilhas de monitoramento, laudos e ações corretivas]
${FOOTER}`,
  },
  {
    key: 'ficha-tecnica',
    name: 'Ficha Técnica / Especificação',
    description: 'Especificação técnica de produto ou material: características, parâmetros, embalagem e critérios de aceitação.',
    category: DocumentType.TECHNICAL_SPECIFICATION,
    sigla: 'PRO',
    content: `${HEADER}# 1. Identificação

| Campo | Informação |
|---|---|
| Produto/Material | |
| Código interno | |
| Fornecedor/Fabricante | |
| Aplicação | |

# 2. Características Técnicas

| Parâmetro | Especificação | Método de análise | Tolerância |
|---|---|---|---|
| | | | |
| | | | |

# 3. Composição / Ingredientes

[Liste a composição, quando aplicável, com destaque para alergênicos.]

# 4. Embalagem e Identificação

| Item | Especificação |
|---|---|
| Embalagem primária | |
| Embalagem secundária | |
| Rotulagem obrigatória | |

# 5. Armazenamento e Transporte

[Condições de temperatura, umidade, empilhamento e validade.]

# 6. Critérios de Aceitação e Rejeição

- **Aceitar quando:** [critérios]
- **Rejeitar quando:** [critérios]
${FOOTER}`,
  },
];

export function findLibraryTemplate(key: string): LibraryTemplate | undefined {
  return TEMPLATE_LIBRARY.find((template) => template.key === key);
}
