import { HelpCatalogCategory } from './types';

export const qualidadeCompliance: HelpCatalogCategory = {
  slug: 'qualidade-compliance',
  title: 'Qualidade e Compliance',
  description: 'Documentos (GED), formulários e checklists, auditorias, NCs, riscos e processos.',
  icon: 'ShieldCheck',
  position: 4,
  articles: [
    {
      slug: 'como-funciona-o-modulo-de-documentos',
      title: 'Como funciona o módulo de Documentos (GED)?',
      summary: 'Gestão eletrônica de documentos: acervo, versões, validade e aprovação.',
      tags: ['documentos', 'ged', 'acervo', 'procedimento', 'politica', 'versao', 'validade'],
      body: `O módulo **Documentos** (Qualidade e Compliance > Documentos) é o GED da empresa: políticas, procedimentos, instruções de trabalho, manuais, formulários e registros — com versão, validade, aprovação e publicação controladas.

## A tela do acervo
- **Navegação à esquerda** — filtre por situação (vigentes, em elaboração, a revisar, vencidos) e por tipo de documento, com contadores;
- **Tabela central** — código, título, tipo, revisão, status, validade (vencidos em destaque) e responsável;
- **Pendências** — cartões de validade (documentos vencendo) e leituras pendentes.

## Ciclo de vida de um documento
Rascunho → Em revisão → Aprovado → **Publicado** → Obsoleto. Cada revisão gera nova versão, preservando o histórico.

## Recursos principais
- **Código automático** por tipo (padronização);
- **Validade e revisão periódica** — o sistema avisa quando o documento está para vencer e notifica o responsável;
- **Confirmação de leitura** — prova de ciência dos colaboradores;
- **Edição online** no navegador (veja o artigo sobre liberação de edição);
- **Modelos** — crie documentos a partir de templates da empresa.

Documentos publicados também alimentam o Assistente G360: ele pode responder com base nos procedimentos da sua empresa.`,
    },
    {
      slug: 'criar-documento-a-partir-de-modelo',
      title: 'Modelos de documento: criar, importar e usar',
      summary: 'Galeria de modelos, importação de .docx e criação de documento com placeholders.',
      tags: ['modelo', 'template', 'docx', 'importar', 'galeria', 'novo documento'],
      body: `Modelos padronizam a criação de documentos (POP, ata, política, procedimento etc.).

## Usar um modelo existente
1. Em **Documentos > Modelos**, veja a galeria de modelos da empresa (há modelos prontos de política, procedimento, instrução, ata, manual e outros).
2. Clique em **Criar documento a partir do modelo**: o sistema preenche automaticamente marcadores como nome da empresa, código e data.
3. Complete o conteúdo e siga o fluxo normal (revisão → aprovação → publicação).

## Criar ou importar um modelo
- **Criar no portal** — monte o modelo direto no editor;
- **Importar um .docx** — envie um arquivo Word existente como modelo (inclusive um que você baixou do próprio portal e ajustou);
- **Baixar** — exporte qualquer modelo como .docx para trabalhar fora.

## Publicação em PDF
Ao publicar um documento, o sistema pode gerar o **PDF oficial** da versão — é ele que circula para leitura e ciência.`,
    },
    {
      slug: 'fluxo-aprovacao-publicacao-documentos',
      title: 'Aprovação, publicação e confirmação de leitura',
      summary: 'O fluxo de liberação do documento e a prova de ciência dos colaboradores.',
      tags: ['aprovacao', 'publicar', 'leitura', 'ciencia', 'revisao', 'workflow documento'],
      body: `## Fluxo de aprovação
1. O autor elabora o documento (status **Rascunho**);
2. Envia para **Revisão** — o aprovador é notificado e a pendência aparece no **Meu Dia/Tarefas** dele;
3. O aprovador **aprova** (ou devolve com justificativa);
4. O documento é **Publicado** — passa a valer e fica disponível no acervo;
5. Revisões futuras criam **nova versão**; a anterior fica no histórico. Documentos substituídos ficam **Obsoletos**.

## Validade e revisão periódica
Defina a validade do documento; o sistema monitora e **notifica o responsável** quando está próximo do vencimento ou vencido — a pendência também aparece nos painéis.

## Confirmação de leitura (prova de ciência)
Para políticas e procedimentos críticos, exija **confirmação de leitura**: cada colaborador marca ciência, e você tem o registro de **quem leu e quando** — essencial para auditorias e compliance trabalhista.`,
    },
    {
      slug: 'edicao-online-e-liberacao-de-edicao',
      title: 'Edição online e liberação de edição de documentos',
      summary: 'Edite Word no navegador e controle quem pode editar via fluxo de liberação.',
      tags: ['edicao online', 'editor', 'word', 'collabora', 'liberar edicao', 'editar documento'],
      body: `## Edição online
Documentos Word (.docx) podem ser editados **direto no navegador**, sem instalar nada — com salvamento automático. Abra o documento e use a opção de **editar online**.

## Fluxo de liberação de edição
Para manter o controle documental, a edição de um documento publicado é **liberada mediante solicitação**:

1. Quem precisa alterar solicita a **liberação de edição** (com motivo);
2. O **aprovador** do documento recebe a pendência em **Tarefas/Meu Dia** e decide: **Liberar** ou **Rejeitar** (com justificativa);
3. Liberado, o solicitante edita (online ou por upload de nova versão) e **Conclui** a edição;
4. A nova versão segue o fluxo de aprovação normal.

Assim ninguém altera um procedimento vigente por conta própria — toda mudança tem autor, aprovador e trilha de auditoria.`,
    },
    {
      slug: 'formularios-e-checklists',
      title: 'Formulários e Checklists: construtor e execução',
      summary: 'Monte formulários sem código, publique versões e colete respostas com evidência.',
      tags: ['formulario', 'checklist', 'inspecao', 'builder', 'construtor', 'campo', 'pergunta'],
      body: `O módulo **Formulários e Checklists** (Qualidade e Compliance > Formulários) é um construtor sem código para checklists de inspeção, verificações e coletas de dados.

## Criar um modelo de formulário
1. Clique em **Novo modelo**: dê um título e uma descrição.
2. Adicione **perguntas** em cartões: cada uma com enunciado, **tipo de resposta** (texto, número, data, sim/não, conformidade, seleção única/múltipla…) e opções quando aplicável.
3. Configure por pergunta: **obrigatoriedade**, **evidência obrigatória** (exige foto/arquivo) e **criticidade** (Normal ou Crítico).
4. Reordene, duplique ou exclua perguntas pelos botões do cartão.
5. **Publique** o modelo — publicações geram **versões** (as respostas antigas continuam ligadas à versão em que foram coletadas).

Há também **sugestões por IA** para montar o checklist a partir do tema.

## Executar/preencher
- Os preenchimentos registram respostas, **evidências**, **assinatura eletrônica** e podem exigir **aprovação**;
- Cada envio vira um **registro operacional rastreável** com linha do tempo;
- Respostas reprovadas podem **gerar Não Conformidade automaticamente** (veja o artigo específico).`,
    },
    {
      slug: 'como-gerar-qr-code-de-formulario',
      title: 'Como gerar QR Code de formulário?',
      summary: 'Publique o checklist e gere o QR para preencher pelo celular no local.',
      tags: ['qr code', 'formulario', 'checklist', 'celular', 'imprimir', 'campo'],
      body: `O QR Code leva o preenchimento do checklist para onde o trabalho acontece (linha de produção, empilhadeira, banheiro, guarita):

1. Acesse **Qualidade e Compliance > Formulários** e localize o modelo desejado (ele precisa estar **publicado**).
2. Use a ação **QR Code** do modelo.
3. **Imprima** o QR gerado e fixe no local físico.
4. Quem escanear com a câmera do celular abre direto o formulário para preencher — com evidências (foto) e assinatura, se configurados.

## Dicas
- O colaborador precisa de acesso ao portal (o QR abre a tela de preenchimento após o login);
- Combine com a **instalação do app (PWA)** no celular para acesso rápido;
- QR Codes também existem em outros módulos: pontos de ronda (Segurança Patrimonial) e autorizações de acesso.`,
    },
    {
      slug: 'checklist-reprovado-gera-nc',
      title: 'Checklist reprovado gera Não Conformidade automática',
      summary: 'Configure o modelo para abrir NC quando houver resposta não conforme.',
      tags: ['nc automatica', 'checklist', 'reprovado', 'nao conforme', 'automacao'],
      body: `Modelos de checklist podem abrir uma **Não Conformidade automaticamente** quando o preenchimento tem respostas reprovadas.

## Como configurar
1. No modelo do formulário, abra as **Configurações avançadas**.
2. Ative a opção de **NC automática**.
3. Escolha o critério: qualquer resposta não conforme, ou **apenas perguntas críticas**.

## Como funciona
- Perguntas de **conformidade** reprovadas sempre contam; perguntas **sim/não** contam quando marcadas como críticas;
- Ao concluir um preenchimento com reprovação, o sistema cria a NC com origem **Checklist**, já vinculada ao formulário e às respostas;
- A NC entra no ciclo normal (triagem → análise → ação → verificação) e aparece para o responsável no Meu Dia.

Assim, nenhuma inspeção reprovada "morre" no papel: ela vira tratativa rastreável.`,
    },
    {
      slug: 'como-abrir-uma-nao-conformidade',
      title: 'Como abrir uma não conformidade?',
      summary: 'O ciclo CAPA completo: abertura, contenção, causa raiz, ação e eficácia.',
      tags: ['nao conformidade', 'nc', 'capa', 'corretiva', 'abrir nc', 'iso 9001'],
      body: `1. Acesse **Qualidade e Compliance > Não Conformidades** e clique em **Nova NC**.
2. Preencha:
   - Descrição do problema;
   - **Origem** — Indicador, Auditoria, Processo, Cliente, Fornecedor, Checklist, Inspeção ou Manual;
   - **Severidade** — Menor, Maior ou Crítica;
   - Área e responsável.
3. Registre a **ação imediata (contenção)** — o que foi feito na hora para conter o efeito.
4. Investigue e registre a **causa raiz** (use as ferramentas de análise de causa quando o caso pedir método).
5. Crie o **plano de ação corretiva** vinculado.
6. Após executar, faça a **verificação de eficácia**: a NC só fecha quando a correção comprovadamente funcionou.

## Status do ciclo
Aberta → Triagem → Análise → Ação → Verificação → **Fechada**.

NCs também nascem automaticamente de **checklists reprovados** e de **achados de auditoria**. NCs atribuídas a você aparecem no **Meu Dia**.`,
    },
    {
      slug: 'auditorias-programa-execucao',
      title: 'Auditorias: programa, checklist, achados e follow-up',
      summary: 'Do planejamento anual baseado em risco à NC gerada pelo achado.',
      tags: ['auditoria', 'programa', 'achado', 'constatacao', 'auditor', 'norma', 'iso'],
      body: `O módulo **Auditorias** (Qualidade e Compliance > Auditorias) cobre o ciclo completo de auditorias internas, externas, de processo, fornecedor, segurança e qualidade.

## Planejamento
- **Programas de auditoria** — o plano anual;
- **Universo auditável + critérios de risco** — priorize o que auditar com base em risco;
- **Pool de auditores** com sugestão automática de auditor (evita conflito de interesse);
- **Normas/requisitos** (ex.: ISO 9001) como critérios.

## Execução
1. Crie a auditoria a partir do programa, com escopo, norma e auditores.
2. Use **modelos de checklist** de auditoria e execute-os registrando as respostas.
3. Registre as **constatações**: conformidade, não conformidade, observação ou oportunidade — cada uma ligada ao requisito da norma.
4. **Achados de não conformidade geram NC** diretamente, entrando no ciclo CAPA.

## Fechamento
- **Relatório** da auditoria com decisão;
- **Follow-ups** para acompanhar as tratativas até a próxima auditoria.

Tudo fica no painel do módulo, com resumo por status e pendências.`,
    },
    {
      slug: 'gestao-de-riscos-matriz',
      title: 'Gestão de Riscos: matriz 5×5, risco residual e mitigação',
      summary: 'Registre riscos, meça probabilidade × impacto e acompanhe a redução.',
      tags: ['risco', 'matriz de risco', 'probabilidade', 'impacto', 'residual', 'mitigacao', 'heatmap'],
      body: `O módulo **Riscos** (Qualidade e Compliance > Riscos) é o registro corporativo de riscos com medição estruturada.

## Cadastrar um risco
1. Clique em **Novo risco**: descreva o risco e classifique a **categoria** (Estratégico, Operacional, Financeiro, Compliance, Segurança, Ambiental, Qualidade, Processo).
2. Avalie o **risco inerente**: **probabilidade (1–5) × impacto (1–5)** — o sistema calcula o índice e o nível (o formulário mostra a prévia do nível na hora).
3. Registre o **plano de mitigação** e o **plano de contingência**, com responsável e prazo.
4. Avalie o **risco residual** (probabilidade × impacto **após** os controles) — o sistema calcula o **percentual de redução do risco**.

## Matriz 5×5 (heatmap)
O painel mostra as matrizes **inerente e residual** lado a lado. Cada célula é clicável e **filtra a lista** para os riscos daquela combinação — ideal para revisões periódicas.

## Vínculos e ciclo
Riscos se conectam a **indicadores**, **projetos** e **ações de mitigação**; o status acompanha o ciclo: Identificado → Analisando → Mitigando → Monitorando → Aceito/Fechado. Riscos críticos aparecem no **Meu Dia** do responsável.`,
    },
    {
      slug: 'processos-sipoc',
      title: 'Processos e SIPOC',
      summary: 'Mapeie processos com fornecedores, entradas, etapas, saídas e clientes.',
      tags: ['processo', 'sipoc', 'mapeamento', 'etapa', 'fluxo de processo'],
      body: `O módulo **Processos e SIPOC** (Qualidade e Compliance) documenta os processos da empresa no formato SIPOC:

- **S**uppliers (fornecedores) — quem fornece as entradas;
- **I**nputs (entradas) — o que o processo recebe;
- **P**rocess (processo) — as etapas do trabalho;
- **O**utputs (saídas) — o que o processo entrega;
- **C**ustomers (clientes) — quem recebe as saídas.

## Como mapear
1. Crie o processo com tipo (Core, Apoio ou Gestão), objetivo, versão e status.
2. Preencha fornecedores, entradas, saídas e clientes.
3. Cadastre as **etapas** do fluxo, cada uma com responsável.
4. Vincule o processo ao **indicador** que o mede e à área dona.

## Valor
Processos documentados alimentam auditorias, treinamentos e a análise de impacto — quando algo muda, você sabe quais processos são afetados.`,
    },
    {
      slug: 'analise-de-impacto-visao-360',
      title: 'Análise de Impacto (Visão 360°)',
      summary: 'Vincule entidades e simule: "se eu mexer aqui, o que é afetado?".',
      tags: ['impacto', 'visao 360', 'vinculo', 'simulacao', 'dependencia', 'central de impactos'],
      body: `A **Análise de Impacto** (Qualidade e Compliance > Análise de Impacto) mostra a teia de relacionamentos entre tudo que existe na plataforma.

## Recursos
- **Vínculos** — conecte entidades: indicador ↔ processo ↔ documento ↔ risco ↔ ação ↔ reunião;
- **Simulação de impacto** — antes de mudar algo (um processo, um documento), veja tudo que depende dele;
- **Impactos pendentes** — mudanças que geraram efeitos ainda não tratados, com fluxo de resolução;
- **Busca global** e **exportação XLSX**.

## Quando usar
- Revisão de documento: quais processos e áreas são afetados?
- Mudança de processo: quais indicadores podem sofrer efeito?
- Auditoria: navegue a cadeia completa de um achado.

É a visão sistêmica da gestão de mudanças — nada muda "no escuro".`,
    },
  ],
};
