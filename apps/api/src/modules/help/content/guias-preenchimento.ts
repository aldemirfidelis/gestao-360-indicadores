import { HelpCatalogCategory } from './types';

export const guiasPreenchimento: HelpCatalogCategory = {
  slug: 'guias-de-preenchimento',
  title: 'Guias de preenchimento',
  description: 'Passo a passo detalhado, campo a campo: Ishikawa, 5 Porquês, 5W2H, PDCA, desvio, indicador, NC, risco e mais.',
  icon: 'ClipboardList',
  position: 11,
  articles: [
    {
      slug: 'como-preencher-ishikawa',
      title: 'Como preencher o Ishikawa (diagrama de causa e efeito / espinha de peixe)',
      summary: 'Guia completo: o método 6M, exemplos de causas por categoria e o passo a passo na tela.',
      tags: ['ishikawa', 'preencher ishikawa', 'espinha de peixe', 'causa e efeito', '6m', 'diagrama', 'analise de causa'],
      body: `O **Ishikawa** (diagrama de causa e efeito, ou espinha de peixe) organiza as possíveis causas de um problema em 6 categorias — os **6M**. É a primeira ferramenta da sequência de análise (Ishikawa → 5 Porquês → 5W2H → PDCA).

## Onde fica
Abra o **plano de ação** ou a **reunião** vinculada ao desvio e vá na aba **Análise de Causa**. O Ishikawa é o primeiro bloco (as demais ferramentas desbloqueiam em sequência).

## Passo a passo na tela
1. **Confira o problema (efeito)** — a "cabeça do peixe" já vem preenchida com o problema do desvio/plano. É ele que você vai explicar.
2. **Adicione causas em cada categoria (6M)** — clique na categoria e escreva a causa possível. Registre TODAS as hipóteses levantadas pela equipe, mesmo as incertas:
   - **Método** — o jeito de trabalhar: procedimento inexistente/desatualizado, sequência errada, falta de padrão, instrução ambígua. Ex.: "não existe POP para a troca de turno".
   - **Máquina** — equipamentos: falha, manutenção atrasada, desgaste, calibração vencida, capacidade insuficiente. Ex.: "sensor da esteira descalibrado".
   - **Mão de obra** — pessoas: falta de treinamento, equipe reduzida, turnover, fadiga, comunicação falha. Ex.: "operador novo sem treinamento no equipamento".
   - **Material** — insumos: matéria-prima fora de especificação, fornecedor irregular, armazenamento inadequado. Ex.: "lote de matéria-prima com umidade acima do limite".
   - **Medida** — medição e dados: instrumento sem aferição, indicador mal definido, dado digitado errado, frequência de medição insuficiente. Ex.: "balança sem aferição há 8 meses".
   - **Meio ambiente** — o entorno: temperatura, umidade, iluminação, layout, clima organizacional, sazonalidade. Ex.: "calor excessivo no galpão no verão".
3. **Defina a prioridade de cada causa** — marque as mais prováveis/impactantes (alta), as possíveis (média) e as improváveis (baixa). Isso guia a investigação.
4. **Use as "Dicas de IA"** — o botão sugere causas típicas para o seu problema; aproveite como checklist do brainstorm (aceite só o que faz sentido na sua realidade).
5. **Aprofunde as causas prioritárias** — na causa mais provável, clique em **"Investigar nos 5 Porquês"**: ela vira o ponto de partida da próxima ferramenta.
6. Se uma causa já exige providência imediata, use **converter em ação** — ela vira item do plano.

## Boas práticas
- Preencha em grupo (o Ishikawa é uma ferramenta de brainstorm, não de gabinete);
- Causa é hipótese, não culpa: escreva fatos ("procedimento desatualizado"), não pessoas ("fulano errou");
- Não pare na primeira causa boa — o objetivo é abrir o leque; o afunilamento acontece nos 5 Porquês;
- 3 a 6 causas por categoria costuma ser saudável; categoria vazia merece a pergunta "temos certeza que não há nada aqui?";
- Você pode **exportar o diagrama como imagem (PNG)** para anexar à ata da reunião.`,
    },
    {
      slug: 'como-preencher-5-porques',
      title: 'Como preencher os 5 Porquês',
      summary: 'Guia com exemplo encadeado completo até a causa raiz.',
      tags: ['5 porques', 'cinco porques', 'preencher 5 porques', 'causa raiz', 'porque'],
      body: `Os **5 Porquês** aprofundam uma causa do Ishikawa perguntando "por quê?" em cadeia até chegar à **causa raiz** — aquela que, resolvida, impede o problema de voltar.

## Onde fica
Aba **Análise de Causa** do plano de ação ou da reunião — desbloqueia após o Ishikawa. Se você clicou em **"Investigar nos 5 Porquês"** numa causa do Ishikawa, ela já entra como ponto de partida.

## Passo a passo na tela
1. **Nível 1** — escreva a causa a investigar (vinda do Ishikawa) e pergunte: por que isso acontece? Registre a resposta no cartão.
2. **Níveis seguintes** — cada resposta vira a pergunta do próximo nível. Adicione quantos níveis precisar (pode passar de 5; pare quando a resposta sair do seu controle ou virar "porque sim").
3. **Marque a causa raiz** — no nível em que a resposta é acionável e explica todo o encadeamento, use **marcar como causa raiz**. Ela **propaga automaticamente para o campo "causa raiz" do desvio** vinculado (que é bloqueado para edição manual justamente por isso).
4. **Converta em ação** — qualquer nível pode gerar uma ação do plano (botão converter em ação); normalmente a causa raiz gera a ação principal.
5. Use as **sugestões de IA** se a equipe empacar.

## Exemplo completo
Problema: "entrega ao cliente atrasou".
- **Por quê? (1)** O caminhão saiu atrasado do CD.
- **Por quê? (2)** A conferência da carga demorou 2h a mais.
- **Por quê? (3)** O conferente estava sozinho no turno.
- **Por quê? (4)** A escala não cobre férias do segundo conferente.
- **Por quê? (5)** Não existe regra de cobertura de férias na escala do CD. ← **causa raiz** (acionável: criar regra de cobertura).

## Boas práticas
- Respostas devem ser **verificáveis** (fatos, não opiniões);
- Se em um nível existem duas explicações independentes, escolha a mais provável — a outra pode virar nova linha de investigação;
- Causa raiz "falta de atenção do funcionário" quase sempre esconde uma causa de processo — pergunte mais um porquê.`,
    },
    {
      slug: 'como-preencher-5w2h',
      title: 'Como preencher o 5W2H',
      summary: 'Os 7 campos explicados um a um, com exemplo, e como gerar a tarefa do plano.',
      tags: ['5w2h', 'preencher 5w2h', 'plano', 'what', 'why', 'who', 'how much', 'gerar tarefa'],
      body: `O **5W2H** transforma a causa raiz em um plano de execução claro respondendo 7 perguntas. Na plataforma, ele fica na aba **Análise de Causa** e desbloqueia após os 5 Porquês.

## Os 7 blocos (campo a campo)
1. **O quê (What)** — a ação que será feita. Escreva com verbo no infinitivo e resultado esperado. Ex.: "Criar regra de cobertura de férias na escala do CD".
2. **Por quê (Why)** — a justificativa, normalmente a causa raiz encontrada. Ex.: "Ausências programadas deixam a conferência com uma pessoa só, atrasando expedição".
3. **Onde (Where)** — o local/área/processo em que a ação acontece. Ex.: "Centro de Distribuição — expedição".
4. **Quando (When)** — o prazo (e marcos, se houver fases). Ex.: "Regra publicada até 15/08; primeira escala com a regra em 01/09".
5. **Quem (Who)** — o responsável (um nome, não um setor). Ex.: "Maria Souza (supervisora de logística)".
6. **Como (How)** — os passos para executar. Ex.: "1) Mapear férias do ano; 2) Definir dupla de cobertura; 3) Atualizar POP da escala; 4) Treinar equipe".
7. **Quanto custa (How much)** — o custo estimado (horas, contratação, material). Ex.: "R$ 0 — remanejamento interno" ou "R$ 3.500 — 40h de hora extra no período de transição".

## Passo a passo na tela
1. Preencha cada bloco clicando nele (edição direta no cartão);
2. Use as **sugestões de IA** para rascunhar a partir da causa raiz;
3. Ao final, clique em **"Concluir e gerar tarefa"** — o sistema cria a **primeira tarefa do plano de ação** com o responsável e prazo do 5W2H (e cria o próprio plano, se ainda não existir).

## Boas práticas
- Um 5W2H por ação principal — se surgiram 3 ações diferentes, são 3 execuções;
- "Quem" com dono único evita o efeito "todo mundo = ninguém";
- Se o "Como" ficou com mais de ~6 passos, considere quebrar em tarefas separadas no plano.`,
    },
    {
      slug: 'como-preencher-pdca',
      title: 'Como preencher o PDCA',
      summary: 'Os 4 quadrantes explicados, o que escrever em cada um e como acompanhar o giro.',
      tags: ['pdca', 'preencher pdca', 'plan do check act', 'melhoria continua', 'quadrante'],
      body: `O **PDCA** (Planejar, Fazer, Checar, Agir) fecha a sequência de análise: é o ciclo de gestão que garante que o plano gira até o problema ser resolvido de verdade. Na plataforma fica na aba **Análise de Causa**, desbloqueado após o 5W2H.

## Os 4 quadrantes (o que escrever)
1. **Plan (Planejar)** — o problema, a causa raiz, a **meta** (quanto o indicador deve voltar a atingir e até quando) e as ações planejadas. O sistema **pré-preenche** com o problema, a causa consolidada e o indicador do desvio — revise e complete a meta. Ex.: "Reduzir atraso de entregas de 12% para ≤3% até outubro".
2. **Do (Fazer)** — a execução: registre o que foi feito, quando e por quem (as tarefas do plano de ação são o detalhe disso). Ex.: "Regra de cobertura publicada em 12/08; equipe treinada em 20/08".
3. **Check (Checar)** — a verificação com dados: o indicador melhorou? Compare o resultado ANTES × DEPOIS usando os períodos do indicador. Ex.: "Set: atraso caiu para 4,1%; Out: 2,8% — meta atingida".
4. **Act (Agir)** — a consolidação: se funcionou, **padronize** (atualize o POP, treine, replique para outras áreas); se não funcionou, **volte ao Plan** com o aprendizado (a causa raiz pode ter sido outra). Ex.: "POP-LOG-014 atualizado; regra replicada ao CD 2".

## Passo a passo na tela
1. Revise o quadrante **Plan** pré-preenchido e complete a meta;
2. Atualize **Do** conforme as tarefas avançam;
3. Em **Check**, registre os resultados dos períodos seguintes do indicador;
4. Em **Act**, registre a padronização (ou o reinício do ciclo);
5. Marque cada **etapa como concluída** e use **gerar tarefa** quando um quadrante exigir trabalho adicional;
6. As **sugestões de IA** ajudam a redigir cada quadrante.

## Boas práticas
- O Check é com **número do indicador**, não com sensação ("parece melhor" não fecha PDCA);
- Um PDCA sem Act registrado é um plano que pode regredir — padronize sempre;
- O ciclo pode girar mais de uma vez — isso é normal e saudável.`,
    },
    {
      slug: 'como-preencher-um-desvio',
      title: 'Como preencher um desvio (Fato, Impacto e Providência)',
      summary: 'Campo a campo da abertura do desvio, com exemplos de preenchimento bom e ruim.',
      tags: ['desvio', 'preencher desvio', 'fato', 'impacto', 'providencia', 'fca', 'severidade', 'abrir desvio'],
      body: `O desvio registra o tratamento de um **indicador estratégico** fora da meta. Abra em **Gestão à Vista > Desvios > Novo desvio** (ou a partir da tela do indicador).

## Campo a campo
1. **Indicador e período** — selecione o indicador estratégico e o período do resultado fora da meta.
2. **Título** — resuma o problema em uma frase. Bom: "Atraso de entregas 12% acima da meta em junho". Ruim: "Problema logística".
3. **Fato** — O QUE aconteceu, com números. Descreva o resultado versus a meta e o contexto observável. Bom: "O % de entregas no prazo fechou junho em 82% contra meta de 94%; a queda concentrou-se na semana 4". Ruim: "Indicador ruim no mês".
4. **Impacto** — a CONSEQUÊNCIA do fato para o negócio/cliente. Bom: "3 clientes-chave notificaram atraso; multa contratual estimada em R$ 25 mil; risco de perda do contrato X". Ruim: "Impacto negativo".
5. **Providência imediata** — a CONTENÇÃO feita na hora (não é a solução definitiva). Bom: "Contratado frete dedicado para os pedidos críticos da semana; backlog zerado em 3 dias". Se nada foi feito, marque **"não houve providência imediata"** — o sistema então exige a análise estruturada.
6. **Severidade** — Baixa (desvio pontual, sem impacto relevante), Moderada (impacto real, recuperável no período) ou **Crítica** (impacto alto/cliente/segurança/recorrente).
7. **Responsável e prazo** — quem conduz a tratativa e até quando.

## Depois da abertura
- Adicione **causas 6M** preliminares (hipóteses);
- O campo **causa raiz consolidada fica bloqueado**: ele será preenchido automaticamente pela ferramenta 5 Porquês na análise;
- Clique em **Criar reunião** para agendar a tratativa — as ferramentas (Ishikawa → 5 Porquês → 5W2H → PDCA) são conduzidas lá ou no plano;
- **Feche o desvio** quando o plano estiver executado e eficaz.`,
    },
    {
      slug: 'como-preencher-um-indicador',
      title: 'Como preencher o cadastro de um indicador (campo a campo)',
      summary: 'O significado de cada campo: tipo, unidade, direção, meta, tolerância e peso.',
      tags: ['indicador', 'preencher indicador', 'unidade', 'direcao', 'tolerancia', 'peso', 'periodicidade', 'tipo'],
      body: `Em **Gestão à Vista > Indicadores > Novo indicador**, cada campo influencia como o farol e as análises funcionam:

## Identificação
- **Nome** — claro e sem sigla obscura. Bom: "% de entregas no prazo (OTIF)". Evite: "IND_LOG_03".
- **Código** — identificador curto opcional para referência (aparece nas buscas e relatórios).
- **Descrição/fórmula** — como o número é calculado e de onde vem o dado (fonte). Essencial para auditoria do número.
- **Área responsável (nó)** — o setor dono do indicador na Árvore Organizacional; define visibilidade e agrupamentos.
- **Responsável e alimentador** — quem responde pelo resultado e quem lança o dado (podem ser pessoas diferentes).

## Comportamento
- **Tipo** — **Estratégico** entra no Painel Executivo, gera **desvios** e participa da Reunião Mensal; Tático/Operacional e demais tipos são para gestão local e prêmio. Na dúvida: se a diretoria cobra este número todo mês, é estratégico.
- **Unidade** — Percentual, Moeda, Quantidade, Horas, Dias, Toneladas, Litros, Índice… (define a formatação).
- **Direção** — **Maior é melhor** (ex.: produtividade) ou **Menor é melhor** (ex.: acidentes, custo). Errar a direção inverte o farol!
- **Periodicidade** — de diária a anual; define os períodos de meta/resultado.
- **Peso** — a importância relativa do indicador em painéis e no prêmio (padrão 1).

## Meta e farol
- **Meta** — o valor-alvo por período (cadastre depois, individualmente ou em lote para o ano).
- **Tolerância (amarelo)** — a folga percentual antes do vermelho. Ex.: meta 94% com tolerância 10% → verde ≥ 94; amarelo entre 84,6 e 94; vermelho abaixo. Tolerância 0 = sem amarelo (verde ou vermelho).

## Depois do cadastro
Lance **metas** e **resultados** por período — o sistema calcula atingimento, desvio e farol automaticamente. Use notas/anexos por período para dar contexto ao número.`,
    },
    {
      slug: 'como-preencher-uma-nc',
      title: 'Como preencher uma Não Conformidade (campo a campo)',
      summary: 'Origem, severidade, contenção, causa raiz e verificação de eficácia bem escritas.',
      tags: ['nao conformidade', 'preencher nc', 'contencao', 'acao imediata', 'eficacia', 'origem', 'capa'],
      body: `Em **Qualidade e Compliance > Não Conformidades > Nova NC**:

## Campo a campo
1. **Título** — o problema em uma frase objetiva. Bom: "Produto expedido sem etiqueta de lote no pedido 4512".
2. **Descrição** — o detalhe: o que foi detectado, onde, quando, por quem, quantidade afetada. Quanto mais específico, melhor a análise.
3. **Origem** — de onde veio a detecção: Indicador, Auditoria, Processo, Cliente (reclamação), Fornecedor, **Checklist** (inspeção reprovada), Inspeção ou Manual. A origem correta alimenta as estatísticas de onde os problemas nascem.
4. **Severidade** — **Menor** (pontual, sem impacto no cliente/produto), **Maior** (afeta processo/cliente, exige ação estruturada) ou **Crítica** (segurança, legal, recorrente, cliente-chave).
5. **Área e responsável** — o setor onde ocorreu e quem trata.
6. **Ação imediata (contenção)** — o que foi feito NA HORA para conter o efeito (segregar lote, retrabalhar, comunicar cliente). Não confundir com a ação corretiva: contenção apaga o incêndio; a corretiva impede o próximo.
7. **Causa raiz** — preencha após investigar (para casos relevantes, use as ferramentas de análise no plano de ação vinculado). Escreva a causa de processo, não o sintoma.
8. **Plano de ação corretiva** — vincule o plano com as ações que eliminam a causa raiz.
9. **Verificação de eficácia** — após executar, registre COMO foi verificado e o resultado: eficaz (sim/não). Ex.: "Auditadas 30 expedições em 60 dias: zero reincidência — eficaz". A NC só fecha com eficácia confirmada.

## Ciclo de status
Aberta → Triagem → Análise → Ação → Verificação → **Fechada**. A NC aparece no Meu Dia do responsável em cada etapa pendente.`,
    },
    {
      slug: 'como-preencher-um-risco',
      title: 'Como preencher um risco (escalas de probabilidade e impacto)',
      summary: 'As escalas 1–5 com âncoras práticas, risco residual e planos de mitigação/contingência.',
      tags: ['risco', 'preencher risco', 'probabilidade', 'impacto', 'escala', 'residual', 'mitigacao', 'contingencia'],
      body: `Em **Qualidade e Compliance > Riscos > Novo risco**:

## Campo a campo
1. **Título** — o risco como evento futuro incerto. Bom: "Parada não programada da caldeira por falta de peça sobressalente". Ruim: "Caldeira" (isso é um ativo, não um risco).
2. **Descrição** — a cadeia causa → evento → consequência.
3. **Categoria** — Estratégico, Operacional, Financeiro, Compliance, Segurança, Ambiental, Qualidade ou Processo.
4. **Probabilidade (1–5)** — âncoras sugeridas: 1 = raro (uma vez em muitos anos); 2 = improvável (já ocorreu no setor); 3 = possível (pode ocorrer no ano); 4 = provável (ocorre algumas vezes ao ano); 5 = quase certo (ocorre com frequência).
5. **Impacto (1–5)** — âncoras: 1 = insignificante (absorvido pela rotina); 2 = menor (perda pequena, sem cliente afetado); 3 = moderado (perda relevante ou cliente afetado); 4 = maior (perda alta, multa, parada); 5 = catastrófico (segurança de pessoas, continuidade do negócio).
6. O sistema calcula o **índice inerente** (probabilidade × impacto, 1–25) e o nível — visível na prévia do formulário e na matriz 5×5.
7. **Plano de mitigação** — ações para REDUZIR probabilidade e/ou impacto (preventivo). Ex.: "manter peça crítica em estoque; contrato de manutenção preditiva".
8. **Plano de contingência** — o que fazer SE o risco se materializar (reativo). Ex.: "acionar caldeira reserva; plano de comunicação com clientes".
9. **Risco residual** — reavalie probabilidade × impacto considerando os controles implantados; o sistema mostra o **% de redução do risco**. Enquanto não avaliar, fica "residual não avaliado".
10. **Responsável e prazo** — o dono do risco e a data da próxima revisão/ação.

## Acompanhamento
Status: Identificado → Analisando → Mitigando → Monitorando → Aceito/Fechado. Use a **matriz 5×5** (células clicáveis) nas revisões periódicas; riscos críticos aparecem no Meu Dia do responsável.`,
    },
    {
      slug: 'como-montar-um-checklist',
      title: 'Como montar um checklist: tipos de pergunta e configurações',
      summary: 'Cada tipo de campo explicado, criticidade, evidência obrigatória e boas práticas.',
      tags: ['checklist', 'formulario', 'tipos de pergunta', 'campo', 'criticidade', 'evidencia obrigatoria'],
      body: `Em **Qualidade e Compliance > Formulários > Novo modelo**, cada pergunta é um cartão com tipo e configurações:

## Tipos de resposta (quando usar cada um)
- **Conformidade** — "Conforme / Não conforme / N.A." — o padrão para inspeções; respostas negativas contam para NC automática.
- **Sim/Não** — perguntas binárias simples; quando marcada como crítica, o "não" também conta para NC automática.
- **Texto curto / Texto longo** — observações, descrições, identificação livre.
- **Número** — leituras e medições (temperatura, pressão, contagem).
- **Data** — datas de validade, fabricação, execução.
- **Seleção única / Múltipla escolha** — listas fechadas (defina as opções no cartão); padronizam a resposta e permitem estatística.

## Configurações por pergunta
- **Obrigatória** — o preenchimento não conclui sem resposta;
- **Evidência obrigatória** — exige anexar foto/arquivo junto da resposta (use nas perguntas que auditor cobra prova);
- **Criticidade** — **Normal** ou **Crítico**: perguntas críticas reprovadas disparam a NC automática (se ativada) e pesam mais na avaliação;
- **Ajuda** — texto de orientação para quem preenche.

## Configurações do modelo (avançadas)
- **NC automática** — abre Não Conformidade quando houver reprovação (toda reprovação ou só críticas);
- **Assinatura eletrônica** e **aprovação** do preenchimento;
- **Publicar** gera versão — edite e republique sem perder o histórico das respostas antigas.

## Boas práticas
- Perguntas curtas, uma verificação por pergunta ("Piso limpo e seco?" são duas);
- Prefira Conformidade a Sim/Não em inspeção (o N.A. evita resposta forçada);
- Peça evidência só onde agrega — excesso de foto mata a adesão;
- Gere o **QR Code** do modelo publicado e fixe no local de inspeção.`,
    },
    {
      slug: 'como-preencher-um-plano-de-acao-bem-feito',
      title: 'Como preencher um plano de ação bem feito',
      summary: 'Título, origem, prioridade, tarefas e evidências que passam em auditoria.',
      tags: ['plano de acao', 'preencher plano', 'tarefas', 'prioridade', 'criticidade', 'boas praticas'],
      body: `Em **Gestão à Vista > Plano de Ação > Nova ação** (ou a partir de desvio/reunião/NC/5W2H):

## Campo a campo
1. **Título** — a ação com verbo e objeto. Bom: "Implantar dupla conferência na expedição do CD 1". Ruim: "Melhorar logística".
2. **Descrição / problema** — o contexto: qual problema origina a ação e o resultado esperado.
3. **Origem** — de onde nasceu (desvio, reunião, auditoria, NC, decisão preventiva) — mantém a rastreabilidade do porquê.
4. **Prioridade e criticidade** — Baixa/Média/Alta/**Crítica**: crítica é para risco a pessoas, cliente ou compliance; alta para impacto direto em meta. Priorize honestamente (tudo crítico = nada crítico).
5. **Responsável** — UMA pessoa dona do plano (as tarefas podem ter responsáveis diferentes).
6. **Prazos** — data de início e fim realistas; o prazo do plano deve cobrir a última tarefa.
7. **Vínculos** — indicador, objetivo estratégico ou desvio relacionados: é o que conecta a ação ao resultado que ela deve mover.

## Tarefas (o plano de verdade)
- Quebre a execução em **tarefas** com responsável e prazo individuais;
- Tarefa boa é verificável: "Publicar POP revisado" (dá para conferir), não "Ver com a equipe";
- A ordem das tarefas conta a história da execução.

## Durante a execução
- Atualize **status** e **progresso (%)** com frequência (o Meu Dia cobra os responsáveis automaticamente);
- Anexe **evidências** em cada tarefa concluída (foto, documento) — status "aguardando evidência" sinaliza pendência de prova;
- Use **comentários** para registrar decisões e desvios de rota.

## Encerramento
- Concluídas as tarefas, solicite a **verificação de eficácia**: alguém confirma com dados que o problema foi resolvido (o indicador voltou?);
- Não eficaz → reabra a análise (a causa raiz pode ter sido outra);
- Exclusões passam por **pedido de exclusão** aprovado — nada some sem rastro.`,
    },
    {
      slug: 'glossario-gestao-360',
      title: 'Glossário do Gestão 360 (termos e siglas)',
      summary: 'O que significa cada termo usado na plataforma, de farol a compa-ratio.',
      tags: ['glossario', 'termos', 'siglas', 'significado', 'o que e', 'dicionario'],
      body: `## Indicadores e resultados
- **KPI / Indicador** — número que mede um resultado ou processo.
- **Meta** — o valor-alvo do período. **Realizado** — o valor efetivamente alcançado.
- **Atingimento** — realizado ÷ meta (em %), considerando a direção do indicador.
- **Farol** — a cor do resultado: verde (na meta), amarelo (dentro da tolerância), vermelho (fora), cinza (sem lançamento).
- **Tolerância** — a folga percentual que define a faixa amarela antes do vermelho.
- **Direção** — se maior é melhor (produção) ou menor é melhor (acidentes, custo).
- **Periodicidade** — a frequência de medição (diária a anual). **Período (periodRef)** — a referência do lançamento (ex.: 2026-06).
- **Indicador estratégico** — tipo que dispara desvio, entra no Painel Executivo e na Reunião Mensal.

## Tratativa e método
- **Desvio** — o tratamento estruturado de um indicador estratégico fora da meta.
- **FCA** — Fato, Causa, Ação: o método de registro do desvio (fato → impacto → providência).
- **Providência imediata / contenção** — o que se faz na hora para conter o efeito (não é a solução definitiva).
- **Causa raiz** — a causa de fundo que, eliminada, impede a repetição do problema.
- **6M** — as categorias do Ishikawa: Método, Máquina, Mão de obra, Material, Medida, Meio ambiente.
- **Ishikawa / espinha de peixe** — diagrama de levantamento de causas possíveis.
- **5 Porquês** — técnica de aprofundamento até a causa raiz.
- **5W2H** — estruturação da ação: What, Why, Where, When, Who, How, How much.
- **PDCA** — ciclo Plan-Do-Check-Act de execução e verificação.
- **Verificação de eficácia** — a confirmação com dados de que a ação resolveu o problema.

## Qualidade
- **NC (Não Conformidade)** — registro de descumprimento de requisito; ciclo **CAPA** (ação corretiva/preventiva).
- **GED** — Gestão Eletrônica de Documentos (o módulo Documentos).
- **Prova de ciência / confirmação de leitura** — registro de que o colaborador leu um documento/comunicado.
- **SIPOC** — mapeamento de processo: Suppliers, Inputs, Process, Outputs, Customers.
- **Achado / constatação** — o resultado de um item auditado (conformidade, NC, observação, oportunidade).
- **Risco inerente × residual** — o risco antes × depois dos controles; **compa 5×5** — matriz probabilidade × impacto.

## Segurança dos Alimentos
- **APPCC/HACCP** — Análise de Perigos e Pontos Críticos de Controle.
- **PCC** — Ponto Crítico de Controle (limite crítico monitorado); **PRP/OPRP** — programas de pré-requisitos.
- **Recall** — recolhimento de produto; **rastreabilidade** — o encadeamento de lotes da matéria-prima ao produto.

## Pessoas e remuneração
- **Compa-ratio** — salário ÷ ponto médio da faixa salarial (1,0 = no meio da faixa).
- **Enquadramento** — a posição do colaborador na faixa do cargo.
- **Competência** — o mês de referência da apuração do prêmio.
- **Espelho (payslip)** — o demonstrativo individual do prêmio; **memória de cálculo** — o passo a passo de como o valor foi obtido.
- **Base elegível** — os colaboradores que participam da apuração no mês.

## Estratégia
- **BSC / Mapa Estratégico** — Balanced Scorecard: perspectivas, objetivos e relações causa-efeito.
- **OKR** — Objectives & Key Results; **KR** — resultado-chave mensurável; **check-in** — atualização periódica.

## Plataforma
- **Meu Dia** — a central de trabalho que agrega pendências de todos os módulos.
- **Visão 360°** — o painel consolidado de uma entidade e seus relacionamentos.
- **Delegação** — passar temporariamente sua caixa de pendências a um colega.
- **Workflow / automação** — fluxo gatilho → condição → ação da Central de Automações.
- **RBAC / permissões** — o controle do que cada perfil vê e faz.
- **PWA** — o app instalável no celular/PC, com notificações push.`,
    },
    {
      slug: 'dicas-rapidas-e-atalhos',
      title: 'Dicas rápidas e atalhos da plataforma',
      summary: 'Busca global, exportações, notificações e pequenos truques do dia a dia.',
      tags: ['dicas', 'atalhos', 'busca', 'exportar', 'notificacoes', 'truques'],
      body: `## Navegação
- **Ctrl+K (ou Cmd+K)** — busca global: indicadores, ações, setores, telas.
- O **tema claro/escuro** alterna no ícone de lua/sol do topo.
- Clique nos **cartões de resumo** de qualquer painel (Meu Dia, Riscos, Documentos) — a maioria filtra a lista abaixo.

## Exportações úteis
- **Ferramentas de análise** (Ishikawa, 5 Porquês, 5W2H, PDCA) exportam como **imagem PNG** — ótimo para a ata;
- **Relatórios** (Administração) exportam indicadores, resultados, ações e desvios em CSV;
- **Descrições de cargo** saem em **Word (DOCX)**; análises de impacto em **XLSX**.

## Notificações
- Ative as **notificações push** (o navegador pede permissão) para receber prazos e aprovações no dispositivo;
- O **sino** no topo concentra as notificações do portal;
- Comunicados com **leitura obrigatória** ficam no Meu Dia até você confirmar ciência.

## QR Codes na operação
- **Formulários/checklists** — preencher no local pelo celular;
- **Pontos de ronda** — o vigilante escaneia em cada checkpoint;
- **Autorizações de acesso** — validação na portaria.

## Pequenos truques
- **Fixar** um item no Meu Dia o mantém no topo; **Acompanhar** permite seguir item de outra pessoa;
- **Filtros salvos** no Meu Dia guardam combinações de aba + tipo + busca;
- Na Árvore Organizacional, use **impacto de remoção** antes de excluir qualquer nó;
- Documentos: o **código automático** por tipo mantém a numeração padronizada — não digite códigos manuais.`,
    },
  ],
};
