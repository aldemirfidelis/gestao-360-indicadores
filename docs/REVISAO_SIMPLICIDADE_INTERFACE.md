# Revisão de simplicidade da interface

Data: 17/11/2026. Publicação autorizada pelo usuário; preparação em andamento.

## Abrangência

Revisão estática das 208 páginas e dos componentes da Web, totalizando 463
arquivos TSX no levantamento. Foram examinados cabeçalhos, resumos,
cards, contadores, listas, atalhos e as referências repetidas aos mesmos dados.
O levantamento incluiu módulos ativos, administração, site público e módulos
suspensos. As correções estão nas telas com redundância identificada e nos
componentes compartilhados; as demais telas recebem o cabeçalho/resumo compacto
quando utilizam esses componentes.

O conteúdo principal de cada tela vem primeiro. Cada conjunto de dados tem um
resumo compacto. Conteúdo complementar fica em abas ou seções recolhíveis.
Metas e resultados, legendas, dados históricos e registros em contextos distintos
continuam disponíveis.

## Correções

| Área | Problema encontrado | Resultado |
| --- | --- | --- |
| Processos | Cabeçalho, nove cards de governança e seis cards de PMO empilhados antes da lista | Lista como visão inicial; três informações no cabeçalho; governança e projetos de melhoria em abas |
| Lista de processos | SIPOC completo e várias ações em todos os registros | SIPOC, etapas e edição aparecem ao expandir o processo; abertura do registro e situação dos projetos continuam diretas |
| Filtros de Processos e Projetos | Formulários de filtro ocupavam várias linhas no celular antes da lista | Busca visível; filtros adicionais expansíveis com quantidade de seleções e limpeza; seleção preservada ao recolher |
| Governança | Total repetido, link para a própria tela e dois conceitos chamados “Em revisão” | Total permanece no cabeçalho; link exibido apenas fora de Processos; revisão de artefatos identificada explicitamente |
| Governança | Projeto de melhoria, sozinho, fazia um processo aparecer como alerta | Painel de atenção considera as razões de governança e desempenho; projetos ficam na visão de melhoria |
| PMO | Cobertura, custos e vários resumos ocupavam o início da tela | Quatro informações principais; cobertura e orçamento em seção complementar; estado vazio sem sequência de zeros |
| Detalhe de processos | Cards repetiam a navegação das abas | Abas concentram o acesso a SIPOC, BPMN, RACI e PMO; atividades em seção recolhível |
| Melhoria de um processo | Tabela, Gantt, Curva S, agenda e seis resumos simultâneos | Quatro resumos e portfólio; cronograma, curva/agenda e custos/riscos sob demanda |
| Portfólio de projetos | Lista aparecia depois de KPIs, atalhos, Gantt, lista de críticos, curva e agenda | Projetos como visão inicial; cronograma e curva/agenda em abas; quatro resumos; ferramentas em botões compactos |
| Detalhe de projetos | Progresso, planejado, diferença e status repetidos entre vários blocos | Curva S concentra a comparação de avanço; situação aparece uma vez; pendências têm acesso ao cronograma |
| Meu Dia | Cabeçalho, “Resumo do seu dia” e “Insights com IA” repetiam números e texto | Um resumo e um painel assistido; filas secundárias vazias deixam de gerar cards |
| Tarefas | Oito cards antes da área de trabalho | Quatro resumos; quantidades relacionadas agrupadas nas descrições |
| Reunião Mensal | Contadores do cabeçalho repetiam o farol do gráfico | Quatro resumos de reunião/execução; distribuição dos faróis fica no painel correspondente |
| Painel Executivo | Legenda explicativa ocupava um card permanente | Mensagem-chave priorizada e explicação dos faróis recolhível |
| Mapa Estratégico | Ações, atrasos, desvios e projetos apareciam em cards e novamente nos atalhos do mesmo painel lateral | Cada contagem aparece no respectivo acesso relacionado |
| Relatórios | Duas ações para gerar o mesmo PDF, contador de formatos e filtro desabilitado | Uma ação de PDF, três resumos e lista compacta de exportações; filtro sem função retirado |
| Não Conformidades | Duas listas dos mesmos registros, seis KPIs, atalhos repetidos e análises empilhadas | Uma lista, quatro resumos e abas para prioridade, causas e auditorias; rodapé repetitivo retirado |
| Cargos e Salários | Sete atalhos repetiam a navegação do módulo | Navegação existente concentra os destinos; Hierarquia incorporada a ela; resumos usam o componente compacto |
| Treinamento | Duas fileiras de resumos antes do conteúdo | Indicadores de conformidade/pendência primeiro; resultados e programação recolhíveis |
| Relatórios de Pessoal | Oito resumos simultâneos na visão geral | Quatro resumos; frequência e horas extras em seção complementar |
| Segurança Patrimonial | Oito resumos simultâneos | Operação principal primeiro; movimentação e conformidade em seção complementar |
| Suprimentos | Oito resumos simultâneos e texto técnico na operação | Compras primeiro; estoque e recebimentos em seção complementar |
| Gestão de Prêmio | Doze cards, incluindo cinco placeholders de fases futuras | Quatro resumos do ciclo; cadastros/histórico recolhíveis; placeholders retirados |
| Componentes compartilhados | Cabeçalhos grandes, brilho, gradientes, cards dentro de cards e ícones destacados | Cabeçalho simples, menor altura, números e rótulos compactos; resumo sem bordas individuais dentro do cabeçalho |

## Preservação funcional

Permissões, filtros, edição, criação, exportação, vínculos e navegação de detalhe
continuam nos fluxos existentes. Os atalhos de foco em processos e as âncoras dos
projetos foram considerados. A demonstração continua sem ações de edição.
O componente de seção complementar usa `details`/`summary`, com suporte nativo
a teclado e carregamento do conteúdo na primeira abertura.

Não há alteração de API, schema, migrations ou dados. Os módulos suspensos
mantêm sua configuração de disponibilidade. Alterações locais anteriores da
demonstração corporativa e da memória operacional foram preservadas.

## Validação

- Web: 17 arquivos e 121 testes existentes aprovados.
- Verificação completa de tipos da Web aprovada, incluindo o build final.
- Lint de 26 arquivos da Web sem erros ou avisos. O build mantém avisos
  anteriores em arquivos fora desta revisão.
- Build de produção local aprovado: 99 páginas geradas. Cópia de ensaio sem
  standalone no Windows; não substitui a validação Linux/Docker de publicação.
- Oito testes novos de interface aprovados, em 1440 e 390 pixels: lista inicial,
  expansão por teclado, edição disponível, filtros preservados ao recolher,
  governança, navegação de projetos, criação sem duplicação e demonstração sem
  edição. Tipagem do spec e da configuração Playwright também aprovada.
- Chromium no bundle final: 24 visões de 18 rotas, em 1440, 768 e 390 pixels,
  incluindo tema escuro. Zero erros JavaScript, zero respostas sintéticas
  ausentes e nenhuma rolagem horizontal na área principal. Conferidas as novas
  abas, a abertura de edição, os atalhos de foco e as preferências de Tarefas.
- As 21 fontes alteradas presentes no build focado conferem byte a byte com o
  checkout. As páginas suspensas permanecem fora do bundle publicado pelo
  mecanismo de escopo do projeto.
- `git diff --check` aprovado. Sem commit, push, deploy ou acesso ao banco.

O ensaio do navegador usa exclusivamente respostas sintéticas. As alterações
dos módulos suspensos são verificadas por código, tipos e lint; a revisão não
reativa esses módulos para testar suas telas pela navegação pública.

Inventário, logs e capturas locais: `output/ui-cleanup/` (ignorado pelo
Git). Testes permanentes de interface: `tests/e2e/ui-simplicity.spec.ts`.

Prévia de Processos: `output/ui-cleanup/browser/processos-1440.png` e
`output/ui-cleanup/browser/processos-390.png`.

## Ocorrência nas evidências locais

A primeira execução da nova suíte usou o `outputDir` padrão do Playwright,
`test-results`. O runner limpou esse diretório, que também continha scripts,
capturas e logs de revisões anteriores. Esses artefatos locais não foram
recuperados. O código do projeto, as alterações locais da demonstração,
a memória operacional, os builds de ensaio e os dados do sistema foram
preservados.

As evidências desta revisão foram regeneradas em `output/ui-cleanup`. A
configuração do Playwright agora usa `test-results/playwright` como saída
padrão exclusiva. Logs de comandos ficam fora do diretório que o runner limpa.
