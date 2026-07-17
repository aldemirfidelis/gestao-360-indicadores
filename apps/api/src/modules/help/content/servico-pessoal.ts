import { HelpCatalogCategory } from './types';

export const servicoPessoal: HelpCatalogCategory = {
  slug: 'servico-pessoal',
  title: 'Serviço Pessoal e Recrutamento',
  description: 'Contratação de ponta a ponta (ATS), colaboradores, ponto, férias e folha.',
  icon: 'UserPlus',
  position: 8,
  articles: [
    {
      slug: 'recrutamento-fluxo-contratacao',
      title: 'Como contratar: o fluxo completo do Recrutamento',
      summary: 'Da requisição de vaga à admissão, passo a passo, com quem faz o quê.',
      tags: ['recrutamento', 'contratacao', 'ats', 'vaga', 'admissao', 'requisicao', 'como contratar'],
      body: `O módulo **Recrutamento e Seleção** (Serviço Pessoal → Recrutamento e Seleção) conduz a contratação de ponta a ponta. O funil no topo da tela mostra em que etapa cada processo está:

1. **Requisição** — o gestor/RH cria a requisição informando cargo, área, tipo de vaga e motivo. Ela nasce como *Rascunho*.
2. **Aprovação** — ao enviar, a requisição passa pelo fluxo de aprovação (RH e, se confidencial/urgente, diretoria). As **travas de quadro e orçamento** avisam se não há saldo — sem saldo, um aprovador registra a **exceção com justificativa** (fica na auditoria). Quem solicita nunca aprova a própria requisição.
3. **Encaminhamento** — aprovada, a requisição é encaminhada ao recrutamento. Se nenhum recrutador foi definido, quem encaminha assume a condução.
4. **Vaga e divulgação** — o recrutador clica em *Criar vaga de divulgação*, ajusta o texto público (a descrição técnica fica protegida) e **publica** no portal de carreiras da empresa.
5. **Seleção** — os candidatos entram no **pipeline** (quadro de etapas). Abra o cartão do candidato para ver triagem, avaliar com o **scorecard**, agendar entrevistas, atribuir testes e, se ativa, usar a análise de IA (ela nunca decide sozinha).
6. **Proposta** — prepare e envie a proposta. Fora da faixa salarial da requisição, exige aprovação de quem tem a permissão específica.
7. **Pré-admissão e ASO** — com a proposta aceita, inicie a pré-admissão: o candidato envia os documentos pelo portal dele; depois de aprovados, solicite o **ASO admissional** (agendado e registrado pela Saúde Ocupacional — dados clínicos não aparecem para o recrutador).
8. **Admissão** — com proposta aceita e ASO apto, preencha os dados do eSocial e clique em **Autorizar admissão**: o colaborador é criado no Serviço Pessoal (base única), a posição é ocupada, o evento S-2200 é gerado, o onboarding começa e as avaliações de experiência **D+45 e D+90** são agendadas.

As pendências de cada papel (aprovar requisição, criar vaga, revisar documentos, avaliar experiência) também aparecem no **Meu Dia**.`,
    },
    {
      slug: 'recrutamento-requisicao-travas',
      title: 'Requisição de vaga, aprovação e travas de quadro/orçamento',
      summary: 'Como abrir a requisição, o que bloqueia e como funcionam as exceções.',
      tags: ['requisicao', 'vaga', 'aprovacao', 'quadro', 'orcamento', 'travas', 'excecao'],
      body: `## Abrir a requisição
Em **Serviço Pessoal → Recrutamento e Seleção → Nova requisição**, informe cargo, área, tipo (aumento de quadro, substituição, temporária…), prioridade, quantidade de vagas, orçamento mensal e o motivo. O recrutador responsável pode ficar para depois — quem encaminhar ao recrutamento assume automaticamente.

## Aprovação
- A requisição *Rascunho* precisa ser **enviada para aprovação**;
- Os passos do fluxo decidem na ordem (ex.: RH e depois diretoria para vagas confidenciais/urgentes);
- **Segregação**: o solicitante não aprova a própria requisição;
- Reprovada ou devolvida, ela volta para ajuste.

## Travas de quadro e orçamento
O painel *Travas de quadro e orçamento* dentro da requisição mostra:
- **Bloqueios** (vermelho) — impedem o encaminhamento até serem resolvidos;
- **Avisos** (amarelo) — ex.: saldo de quadro/orçamento não cadastrado;
- **Exceções pendentes** — sem posição vinculada ou sem saldo, um aprovador pode **aprovar a exceção com justificativa**. Tudo fica registrado na auditoria.

Aprovada e sem pendências, use **Encaminhar ao recrutamento** e depois **Criar vaga de divulgação**.`,
    },
    {
      slug: 'recrutamento-vaga-pipeline',
      title: 'Vaga, portal de carreiras e pipeline de candidatos',
      summary: 'Publicar a vaga, configurar triagem/scorecard e conduzir candidatos no kanban.',
      tags: ['vaga', 'pipeline', 'kanban', 'carreiras', 'triagem', 'scorecard', 'entrevista', 'candidato'],
      body: `## A página da vaga
Cada vaga tem três abas:
- **Pipeline de candidatos** — quadro por etapa; **arraste o cartão** para mudar o candidato de etapa ou clique para abrir o painel completo;
- **Divulgação** — o texto público do portal de carreiras (título, descrição, requisitos, benefícios, faixa salarial opcional). A descrição técnica da requisição fica protegida;
- **Triagem e scorecard** — perguntas respondidas na candidatura (com eliminatórias que sinalizam, sem rejeitar sozinhas) e os critérios de avaliação com peso e escala.

## Publicação
*Publicar* coloca a vaga no portal público de carreiras da empresa (ex.: empresa.gestao360.org/carreiras). É possível pausar, reativar e encerrar.

## Painel do candidato
O painel mostra a **jornada** (candidatura → avaliação → proposta → pré-admissão → ASO → admissão) e o **próximo passo** sugerido. Nele você:
- avalia com o scorecard (**avaliação cega**: só vê as notas dos outros depois de enviar a sua);
- agenda **entrevistas** (o candidato é avisado por e-mail) e atribui **testes**;
- gera a **análise de IA** (opcional, explicável, nunca decide);
- registra notas internas e rejeita com motivo.`,
    },
    {
      slug: 'recrutamento-proposta-admissao',
      title: 'Proposta, pré-admissão, ASO e admissão',
      summary: 'Do aceite do candidato à criação do colaborador com eSocial e onboarding.',
      tags: ['proposta', 'oferta', 'pre-admissao', 'aso', 'admissao', 'esocial', 'experiencia'],
      body: `## Proposta
Prepare a proposta no painel do candidato. A faixa salarial vem da requisição — **fora da faixa**, é preciso aprovação de quem tem a permissão de aprovar propostas. Envie ao candidato, que aceita ou recusa pelo portal dele.

## Pré-admissão
Com a proposta aceita, **inicie a pré-admissão**: o checklist padrão pede RG, CPF, comprovante e dados bancários (você pode solicitar documentos extras). O candidato envia pelo portal; a equipe **aprova, rejeita (com motivo) ou dispensa** cada documento.

## ASO admissional
Documentos aprovados liberam a solicitação do **ASO**. O agendamento e o resultado são registrados por quem tem a permissão de **Saúde Ocupacional** — o recrutador vê apenas resultado e datas, nunca os dados clínicos. Resultado *Apto* (ou *Apto com restrição*) libera a admissão.

## Autorizar admissão
Preencha CPF, data de admissão e os campos do eSocial e clique em **Autorizar admissão**. Em um único passo o sistema:
- cria o **colaborador** no Serviço Pessoal (base única — nada de cadastro paralelo);
- ocupa a **posição** no quadro e converte a reserva de orçamento;
- gera o evento **S-2200** do eSocial (falha no eSocial não trava a admissão);
- inicia o **checklist de integração** (Admissão e Desligamento);
- agenda as avaliações de experiência **D+45 e D+90**.`,
    },
    {
      slug: 'aso-onde-registrar',
      title: 'ASO: onde registrar cada tipo de exame',
      summary: 'Admissional de candidato fica no Recrutamento; exames do quadro ativo ficam em Admissão e Desligamento.',
      tags: ['aso', 'exame ocupacional', 'admissional', 'periodico', 'demissional', 'saude ocupacional'],
      body: `Existem **dois lugares** para exames ocupacionais — cada um com um propósito:

## Recrutamento (candidatos em contratação)
O **ASO admissional do candidato** é conduzido dentro da pré-admissão, no painel do candidato (Recrutamento → vaga → candidato). Ali o acesso é **segregado**: a Saúde Ocupacional agenda e registra o resultado clínico; o recrutador vê apenas apto/inapto e datas. Não registre esse exame manualmente em outra tela — a admissão depende do resultado registrado no fluxo.

## Admissão e Desligamento (quadro ativo)
Os exames de **quem já é colaborador** — periódico, retorno ao trabalho, mudança de risco e demissional — ficam em **Serviço Pessoal → Admissão e Desligamento → aba de Saúde Ocupacional**, com controle de validade e alertas de vencimento.

**Resumo**: candidato → Recrutamento; colaborador → Admissão e Desligamento.`,
    },
  ],
};
