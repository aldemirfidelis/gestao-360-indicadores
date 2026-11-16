# Manual do usuário — Gestão 360

Referência: 16/11/2026. O menu depende do perfil, área e módulos liberados para a empresa. Recursos de Processos descritos aqui pertencem à nova implementação e precisam ser publicados antes do uso em produção.

## Acesso e organização do trabalho

Entre com e-mail, CPF ou matrícula vinculados ao usuário e senha. A empresa pode ter endereço próprio e identidade visual. Solicite ao administrador acesso à sua área e às operações necessárias; atribuição RACI não concede permissão no sistema.

No Meu Dia, consulte prioridades e pendências e abra o registro de origem. Em Tarefas, use quadro, lista, calendário ou linha do tempo conforme as opções do contexto. Atualize responsável, prazo e andamento na fonte correta. Uma tarefa automática pode refletir um plano/projeto; não deve ser tratada como um novo cadastro independente.

## Árvore e estratégia

Na Árvore Organizacional, selecione o item para consultar responsabilidades e indicadores. Gestores autorizados podem manter filhos, responsáveis e atividades. Confirme com o administrador a hierarquia e os nomes usados pela empresa.

No Mapa Estratégico, consulte perspectivas e objetivos; selecione os balões para ver seus vínculos. As linhas selecionadas têm traçado animado para facilitar a leitura das conexões, respeitando preferência por movimento reduzido. Os minimapas React Flow foram retirados das visualizações solicitadas. Versões/publicação preservam o mapa aprovado.

Nos OKRs, escolha o ciclo, objetivo e resultado-chave; faça check-ins com dados reais. Não confunda percentual do KR com resultado de um indicador BSC sem verificar suas definições.

## Indicadores, resultados e desvios

1. Cadastre/consulte indicador com unidade, periodicidade, direção, área, responsável e fonte.
2. Defina metas no período correto. Confirme se maior, menor, igualdade ou faixa representa bom desempenho.
3. Registre o realizado, justificativa e evidências. Submeta/aprove conforme seu perfil.
4. Consulte série e farol. Cinza indica falta de dados suficientes; não significa meta cumprida.
5. Para problema fora da meta, abra a tratativa/desvio correspondente e registre fato, impacto e providência imediata.
6. Use análise de causa, crie/acompanhe o plano e verifique eficácia após a execução.

## Análise e plano de ação

Use Ishikawa para organizar causas, 5 Porquês para aprofundá-las, 5W2H para estruturar o que será feito e PDCA para acompanhar o ciclo. A sequência mostra os nomes das ferramentas, sem números de identificação adicionais. Registre a causa confirmada e mantenha ações ligadas ao problema.

No plano, defina responsável, prazo, prioridade, tarefas e evidências. Concluir tarefas não comprova automaticamente a eficácia. Consulte a avaliação, os resultados posteriores e a eventual necessidade de reabertura. Projetos de melhoria podem ser relacionados ao processo afetado.

## Projetos e Curva S

Abra Projetos para acessar o portfólio/cronograma e o detalhe. Cadastre datas, tarefas, dependências e marcos; confira o orçamento quando utilizado. Dependências precisam pertencer ao mesmo projeto e não formar ciclo.

A Curva S mostra planejado e realizado conforme as regras do cronograma. O histórico realizado começa na primeira medição registrada; datas antigas não criam avanço retroativo. Sem datas suficientes, o planejado pode ficar indisponível. Atualize o progresso real das tarefas, sem usar o desenho BPMN como evidência de execução.

## Reuniões e fechamento mensal

Cadastre horário, participantes, pauta e vínculos. Registre decisões e responsáveis pelos acompanhamentos. Convites dependem da configuração da empresa. Na Reunião Mensal, confira mês, área, indicadores apresentados, pendências e decisões antes de fechar. A Ata e o portfólio Projetos têm finalidades diferentes.

## Processos: preparação

Pré-requisitos: módulo Processos liberado, permissão de leitura e, para manutenção, criação/edição na área. Aprovação e publicação têm permissões próprias.

1. Abra **Processos** e cadastre nome, objetivo, tipo, área e proprietário.
2. Vincule o indicador principal, quando houver, e mantenha as etapas existentes.
3. Abra **SIPOC · BPMN · RACI** no registro.
4. Use Visão geral para conferir contexto; as ferramentas e os registros relacionados pertencem a esse mesmo processo.

## SIPOC

1. Na aba SIPOC, crie o artefato. Os textos e etapas existentes serão aproveitados.
2. Em cada coluna, adicione um item ou selecione um existente para editar os detalhes.
3. Identifique fornecedor/cliente interno ou externo. Descreva entrada, origem, requisitos, saída e critérios de aceitação.
4. Relacione áreas, processos e indicadores existentes. GED/formulários só aparecem quando o módulo correspondente estiver disponível.
5. Clique **Aplicar ao rascunho** no item. Essa ação atualiza o rascunho da tela.
6. Descreva a alteração e clique **Salvar versão** para gravar no banco.

As cinco colunas apresentam a visão macro. Objetivo, proprietário e área vêm do cadastro central; altere-os em **Dados do processo e etapas**. Exportar SIPOC produz um CSV resumido da visão.

## BPMN

1. Na aba BPMN, crie o modelo AS-IS ou TO-BE. Pode usar outro modelo do processo como base.
2. Use a paleta para eventos, tarefas, subprocessos, gateways, pools e lanes. Arraste elementos e conecte o fluxo.
3. Selecione um elemento, edite nome/documentação e clique **Aplicar ao desenho**.
4. Para importar, escolha **Importar BPMN XML**. O arquivo deve ser válido, ter diagrama visual e até 2 MB. Importação substitui o rascunho mediante confirmação quando há alterações.
5. Descreva a alteração e salve. Depois selecione uma atividade salva para definir área, cargo, usuário, duração, SLA, sistemas e detalhes operacionais.
6. Salve as propriedades. Consulte a RACI e os vínculos exibidos para essa atividade.
7. Exporte XML para interoperabilidade e SVG para apresentação visual.

Ao ocorrer erro, leia a mensagem e mantenha/exporte seu rascunho. Se outra pessoa salvou antes, a API recusa sobrescrever a revisão. Exporte seu trabalho e recarregue a versão atual para conciliar as mudanças. O BPMN documenta o fluxo; não inicia automaticamente um workflow.

## RACI

1. Crie a matriz no mesmo processo. Etapas já cadastradas podem ser aproveitadas.
2. Busque pessoas, áreas ou cargos e adicione colunas.
3. Cadastre/edite linhas e, se necessário, selecione atividade BPMN, etapa, tarefa de projeto, tarefa do quadro ou plano existente.
4. Marque R para quem executa, A para o responsável final, C para consultados e I para informados.
5. Use R+A na mesma coluna quando apropriado; vários R são permitidos.
6. Corrija alertas de linhas sem R ou com quantidade de A diferente de um. Grave a versão com justificativa.
7. Alterações organizacionais sinalizadas exigem revisão e confirmação ao salvar. Nenhuma pessoa substitui automaticamente outro responsável.

RACI não cria usuários, cargos ou tarefas e não libera dados confidenciais. O proprietário do processo continua definido no cadastro, mesmo quando outra pessoa é A de uma atividade.

## Vínculos, revisão e histórico

Em **Registros relacionados**, escolha tipo, contexto (processo ou atividade) e o registro existente. Abra o vínculo para consultar indicador, projeto, tarefa, plano, desvio, reunião ou objetivo. As telas integradas mostram **Processos relacionados** para retornar. Vínculos mantidos por SIPOC/RACI devem ser alterados no artefato de origem.

Para governança, descreva a decisão e envie o rascunho para revisão. O usuário autorizado aprova e depois publica. Para modificar conteúdo protegido, use **Criar revisão**. Versões anteriores permanecem disponíveis em **Histórico de versões → Ver versão**; versões antigas adicionais podem ser carregadas. Arquivar conserva o histórico.

O Meu Dia do proprietário apresenta revisões pendentes/vencidas. O painel de governança consolida documentação, proprietários, revisões e relações com dados reais; a lista de atenção abre os processos correspondentes.

## Demais módulos e suporte

GED, formulários, auditorias, riscos, treinamento, pessoal e outras áreas preservadas no repositório dependem de reativação e licença. Seus fluxos estão no [mapa funcional](MAPA_FUNCIONALIDADES.md) e nas documentações específicas vinculadas. Solicite suporte com o registro, período, operação e mensagem de erro; não envie senha nem token.
