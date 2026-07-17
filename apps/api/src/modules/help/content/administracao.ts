import { HelpCatalogCategory } from './types';

export const administracao: HelpCatalogCategory = {
  slug: 'administracao',
  title: 'Administração',
  description: 'Usuários e permissões, automações, importações, relatórios, períodos e atendimento.',
  icon: 'Settings',
  position: 11,
  articles: [
    {
      slug: 'usuarios-perfis-e-permissoes',
      title: 'Usuários, perfis de acesso e permissões',
      summary: 'Crie usuários, atribua perfis e controle o que cada um vê e faz.',
      tags: ['usuario', 'permissao', 'perfil de acesso', 'criar usuario', 'acesso', 'inativar'],
      body: `Em **Administração > Usuários** você gerencia quem acessa o sistema (requer permissão de gestão de usuários).

## Criar um usuário
1. Clique em **Novo usuário**: nome, e-mail e credenciais;
2. Atribua um **perfil de acesso** — o pacote de permissões (ex.: Gestor de área, Operacional, Qualidade);
3. Ajuste **permissões individuais** quando precisar de exceções;
4. Defina a **visibilidade por área** — quais nós da árvore organizacional o usuário enxerga.

## Perfis de acesso
Perfis agrupam permissões por papel. Prefira ajustar o perfil a dar permissões avulsas — facilita a manutenção.

## Boas práticas
- **Inative** (não exclua) quem sai da empresa — o histórico é preservado;
- Revise perfis periodicamente (princípio do menor privilégio);
- As permissões controlam frontend e backend: sem permissão, nem a tela nem a API respondem.`,
    },
    {
      slug: 'central-de-automacoes',
      title: 'Central de Automações (fluxos de trabalho)',
      summary: 'Automatize cobranças, roteamentos e aprovações sem código.',
      tags: ['automacao', 'workflow', 'fluxo de trabalho', 'gatilho', 'aprovacao automatica'],
      body: `A **Central de Automações** (Administração > Central de Automações) é um motor visual de fluxos: **gatilho → condição → ação**.

## Criar um fluxo
1. Crie o **workflow** e desenhe: o **gatilho** (ex.: resultado lançado, prazo vencendo), as **condições** e as **ações** (notificar, criar tarefa, pedir aprovação);
2. **Valide** e **simule** antes de ligar;
3. **Publique** — publicações geram **versões** (dá para voltar atrás).

## Acompanhamento
- **Instâncias** — cada execução do fluxo, com status; dá para **reexecutar (retry)** e **cancelar**;
- **Falhas (dead-letters)** — execuções que falharam, para tratamento;
- **Aprovações e tarefas de fluxo** — chegam ao **Meu Dia/Tarefas** dos responsáveis, como qualquer pendência.

## Exemplos úteis
- Cobrar resultado de indicador não lançado até o dia X;
- Rotear aprovação de documento por tipo;
- Escalar tarefa vencida para o gestor após N dias.`,
    },
    {
      slug: 'importacoes-de-planilhas',
      title: 'Importações de planilhas (CSV/XLSX)',
      summary: 'Carregue dados em lote com pré-visualização e validação antes de gravar.',
      tags: ['importacao', 'planilha', 'csv', 'xlsx', 'excel', 'carga', 'lote'],
      body: `Em **Administração > Importações** você carrega dados em lote — indicadores, metas, resultados, estrutura, colaboradores — sem digitação manual.

## Como funciona
1. Escolha o **tipo de importação** e baixe/prepare a planilha no formato esperado (CSV ou XLSX);
2. Envie o arquivo — o sistema **pré-visualiza e valida** linha a linha, mostrando os erros encontrados **antes** de gravar;
3. Corrija a planilha se houver erros (a tela lista cada problema com a linha);
4. **Confirme (commit)** — só então os dados entram no sistema.

## Dicas
- Nada é gravado até você confirmar — pode testar sem medo;
- Cada importação vira um **job** com histórico e erros consultáveis;
- Vários módulos têm importações próprias também (base elegível do Prêmio, perfis de colaboradores em Cargos e Salários, pessoas em Segurança Patrimonial).`,
    },
    {
      slug: 'relatorios-e-exportacoes',
      title: 'Relatórios e exportações',
      summary: 'Exporte indicadores, resultados, ações e desvios para Excel/BI.',
      tags: ['relatorio', 'exportar', 'csv', 'excel', 'bi', 'dados'],
      body: `Em **Administração > Relatórios** você exporta os dados-chave em CSV:

- **Indicadores** — o cadastro completo;
- **Resultados** — os lançamentos por período;
- **Ações** — os planos de ação e seus status;
- **Desvios** — as tratativas registradas.

## Quando usar
- Alimentar um **BI externo** (Power BI, etc.);
- Análises pontuais no Excel;
- Portabilidade dos seus dados.

Vários módulos também têm exportações próprias (XLSX da Análise de Impacto, relatórios de apuração do Prêmio, export do fluxo de Segurança dos Alimentos). Para **integração contínua**, prefira a **API pública** (veja o artigo de integrações).`,
    },
    {
      slug: 'periodos-ano-de-trabalho',
      title: 'Períodos: o ano de trabalho da empresa',
      summary: 'Abra, defina o período atual e feche o ano para congelar os dados.',
      tags: ['periodo', 'ano', 'fechamento', 'exercicio', 'abertura'],
      body: `Em **Administração > Períodos** a empresa controla seu ciclo anual (requer permissão de configurações):

- **Criar período** — abre o novo ano de trabalho;
- **Definir período atual** — o ano ativo para lançamentos e painéis;
- **Fechar período** — congela o ano encerrado.

## Por que fechar o período
- Os dados fechados ficam **comparáveis e auditáveis** (ninguém altera o passado);
- Metas e resultados do novo ano começam limpos;
- Relatórios históricos mantêm consistência.

Fluxo típico de virada de ano: criar o período novo → cadastrar as metas do ano → definir como atual → fechar o anterior.`,
    },
    {
      slug: 'aprovacoes-central',
      title: 'Central de Aprovações',
      summary: 'Tudo que espera o seu "OK": eficácia, exclusões, cargos e fluxos.',
      tags: ['aprovacao', 'aprovar', 'eficacia', 'exclusao', 'pendente'],
      body: `A central de **Aprovações** concentra o que precisa da sua decisão:

- **Eficácia de ações** — confirmar se um plano concluído realmente resolveu;
- **Pedidos de exclusão** — ninguém apaga um plano sem aprovação;
- **Movimentações de cargo/salário** — promoções e reajustes;
- **Aprovações de fluxo** — etapas de aprovação das automações.

## Como usar
1. Abra a central (ou vá pelo cartão **Aprovações** do Meu Dia);
2. Analise cada item — o contexto vem junto (o quê, quem pediu, por quê);
3. **Aprove ou rejeite** (rejeições pedem justificativa).

Aprovações pendentes também aparecem no **Meu Dia** e contam no cartão de Aprovações — o objetivo é decisão rápida, sem represar o trabalho dos outros.`,
    },
    {
      slug: 'central-de-atendimento-chamados',
      title: 'Central de Atendimento: abrir e acompanhar chamados',
      summary: 'Abra tickets de suporte e converse com a equipe sem sair do sistema.',
      tags: ['chamado', 'ticket', 'suporte', 'atendimento', 'helpdesk', 'problema'],
      body: `Em **Administração > Central de Atendimento** você abre chamados para a equipe de suporte do Gestão 360:

## Abrir um chamado
1. Clique em **Novo chamado**;
2. Descreva o assunto e o problema/solicitação — quanto mais contexto (tela, passo a passo, mensagem de erro), mais rápido o atendimento;
3. Envie.

## Acompanhamento
- O chamado tem **status** (Aberto → Em atendimento → Resolvido);
- A conversa acontece **dentro do chamado** — as respostas da equipe de suporte chegam ali;
- Você pode complementar com novas mensagens a qualquer momento.

Os chamados chegam diretamente à equipe de atendimento da plataforma. Para dúvidas de uso, tente antes o **Assistente G360** (este chat) — ele resolve a maioria das perguntas na hora.`,
    },
    {
      slug: 'central-do-portal',
      title: 'Central do Portal (Super Admin)',
      summary: 'Controle módulos, manutenções, integrações e diagnósticos do portal.',
      tags: ['central do portal', 'super admin', 'configuracoes avancadas', 'manutencao', 'diagnostico'],
      body: `A **Central de Administração do Portal** (Configurações > Avançadas) é restrita ao **Super Admin** da empresa:

- **Módulos e páginas** — controle do que aparece para os usuários;
- **Recursos** — liga/desliga funcionalidades específicas;
- **Manutenções** — registre janelas de manutenção com aviso aos usuários;
- **Integrações** — revise os conectores ativos no ambiente;
- **Diagnósticos** — verificações de saúde do sistema;
- **Auditoria administrativa** — o histórico das alterações de configuração.

Também no perfil Super Admin: gestão do **banco de dados** (Configurações > Banco de Dados) e parâmetros avançados. Use com critério — as mudanças aqui afetam todos os usuários da empresa.`,
    },
    {
      slug: 'integracoes-suportadas',
      title: 'Integrações e API pública',
      summary: 'Conectores SAP/Apdata/SE Suite/REST e a API pública com chaves.',
      tags: ['integracao', 'api', 'conector', 'sap', 'apdata', 'se suite', 'erp', 'chave de api'],
      body: `O Gestão 360 conversa com os sistemas da sua empresa por dois caminhos:

## Conectores (o Gestão 360 busca/recebe dados)
Configure **conectores** para SAP, Apdata, SE Suite ou **REST genérico**:
- Credenciais **cifradas** e isoladas por empresa;
- **Teste** a conexão, **execute** e consulte os **logs** de cada execução;
- Uso típico: puxar resultados de indicadores do ERP, base de colaboradores do RH.

## API pública (seus sistemas falam com o Gestão 360)
Gere **chaves de API** e use a API externa para:
- Consultar **indicadores, áreas e planos de ação**;
- **Enviar resultados** de indicadores;
- Integrar **base elegível e eventos** do Prêmio;
- Verificar disponibilidade (health).

## Outras entradas de dados
- **Importações** CSV/XLSX (Administração > Importações);
- **E-mail** — envio de notificações e convites usa o servidor configurado no Portal Administrativo Global.

Peça ao administrador os acessos: as chaves e conectores exigem permissão de integração.`,
    },
    {
      slug: 'multiempresa-e-planos',
      title: 'Multiempresa, planos e subdomínio próprio',
      summary: 'Como funcionam empresas isoladas, matriz de módulos por plano e branding.',
      tags: ['multiempresa', 'plano', 'empresa', 'subdominio', 'branding', 'tenant', 'essencial', 'enterprise'],
      body: `## Multiempresa (multi-tenant)
Uma instância do Gestão 360 atende **várias empresas**, cada uma com dados totalmente **isolados** — usuários de uma empresa jamais veem dados de outra. Grupos empresariais administram tudo pelo **Portal Administrativo Global** (Super Admin da plataforma), incluindo a troca de empresa ativa.

## Planos (matriz cumulativa)
Cada empresa contrata um plano que habilita módulos:
- **Essencial** — Gestão à Vista (indicadores, desvios, planos, reuniões, mapa);
- **Profissional** — + Qualidade e Compliance + Comunicação;
- **Corporativo** — + Cargos e Salários + Segurança dos Alimentos + Segurança Patrimonial;
- **Enterprise** — + Gestão de Prêmio.
Módulos-base sempre ativos: **Meu Dia, Tarefas e Administração**.

## Subdomínio e marca
Cada empresa pode ter seu **subdomínio próprio** (empresa.gestao360.org) com a **logomarca e cores** na tela de login — a experiência é da marca da empresa, com a segurança da plataforma.`,
    },
    {
      slug: 'privacidade-e-lgpd',
      title: 'Privacidade e LGPD',
      summary: 'Como a plataforma trata dados pessoais e as ferramentas de privacidade.',
      tags: ['lgpd', 'privacidade', 'dados pessoais', 'dpo', 'encarregado', 'ropa', 'incidente'],
      body: `O Gestão 360 leva a **LGPD** a sério em duas frentes:

## Transparência da plataforma
A página pública **/lgpd** documenta como a plataforma trata dados pessoais: bases legais, direitos dos titulares, medidas de segurança e o contato do **Encarregado (DPO)**. Titulares podem exercer seus direitos pelos canais indicados lá.

## Módulo de Privacidade (para o administrador)
O painel administrativo inclui a gestão de privacidade da operação:
- **RoPA** — Registro das Operações de Tratamento (o inventário exigido pelo art. 37);
- **Suboperadores** — o registro de fornecedores que tratam dados em nome da empresa;
- **Incidentes de dados** — registro e acompanhamento de incidentes de segurança com dados pessoais (avaliação de risco e comunicação à ANPD quando aplicável).

## Segurança de base
Isolamento por empresa, controle de acesso granular (RBAC), trilha de auditoria em todas as mutações e redação de dados sensíveis nos logs.`,
    },
  ],
};
