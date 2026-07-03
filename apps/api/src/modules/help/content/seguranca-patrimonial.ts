import { HelpCatalogCategory } from './types';

export const segurancaPatrimonial: HelpCatalogCategory = {
  slug: 'seguranca-patrimonial',
  title: 'Segurança Patrimonial',
  description: 'Portaria, controle de acesso, autorizações com QR Code, rondas e ocorrências.',
  icon: 'Shield',
  position: 6,
  articles: [
    {
      slug: 'seguranca-patrimonial-visao-geral',
      title: 'Segurança Patrimonial: visão geral da portaria digital',
      summary: 'Entradas e saídas, presentes na unidade e operação offline na guarita.',
      tags: ['seguranca patrimonial', 'portaria', 'controle de acesso', 'entrada', 'saida', 'guarita'],
      body: `O módulo **Segurança Patrimonial** substitui o caderno da portaria por um console operacional completo.

## Operação diária (aba Operação)
- **Registrar entrada** de pessoas e veículos (visitantes, prestadores, motoristas, fornecedores);
- **Registrar saída** e acompanhar **pendências de saída** (quem entrou e ainda não saiu);
- **Presentes na unidade** — a lista em tempo real de quem está dentro;
- Funciona em **modo offline** na guarita: se a internet cair, os registros continuam e sincronizam depois.

## Cadastros de apoio
- **Pessoas** (com documento e situação documental), **empresas prestadoras** (com contrato) e **veículos** (placa, modelo, motorista);
- **Portarias/gates** e **postos** de trabalho;
- **Lista de bloqueio** — pessoas/veículos impedidos de entrar.

## Primeiros passos (configuração)
1. Configure **portarias e postos**;
2. Defina as **exigências documentais** (ex.: ASO, CRLV) e o bloqueio;
3. Cadastre pessoas, empresas e veículos;
4. Comece a operar entradas, saídas, autorizações e rondas.`,
    },
    {
      slug: 'autorizacoes-e-qr-code-acesso',
      title: 'Autorizações de acesso com QR Code',
      summary: 'Autorize visitas com janela de tempo, aprovação e QR de validação.',
      tags: ['autorizacao', 'qr code', 'visita', 'convite', 'acesso', 'aprovar'],
      body: `As **autorizações** organizam quem pode entrar, quando e por onde:

1. Crie a **autorização**: pessoa/veículo, motivo, **janela de tempo** (início/fim) e portaria (gate);
2. A autorização passa por **aprovação** (aprovar/rejeitar);
3. O autorizado recebe um **QR Code** — na chegada, a portaria **valida o QR** e registra a entrada em segundos;
4. Para visitantes externos, use o **convite externo**: um link para a própria pessoa preencher seus dados antes da visita.

## Benefícios
- A portaria não decide "no olho": só entra quem tem autorização válida na janela certa;
- A validação por QR elimina digitação e fila;
- Tudo fica registrado para auditoria (quem autorizou, quem validou, quando).`,
    },
    {
      slug: 'exigencias-documentais-e-bloqueio',
      title: 'Exigência documental: documento vencido bloqueia a entrada',
      summary: 'Defina documentos obrigatórios por tipo de pessoa/veículo, com aviso e bloqueio.',
      tags: ['documento', 'aso', 'crlv', 'bloqueio', 'exigencia', 'vencido', 'prestador'],
      body: `As **exigências documentais** (aba Configurações) protegem a empresa de riscos trabalhistas e legais:

1. Defina, por **tipo de pessoa** (prestador, motorista, visitante…) ou **veículo**, quais documentos são obrigatórios — ex.: ASO, treinamento NR, CRLV, seguro;
2. Configure os **dias de aviso** antes do vencimento;
3. Ative o **bloqueio na falta**: com documento vencido ou ausente, o sistema **impede o registro de entrada**.

## No dia a dia
- O cadastro de cada pessoa/empresa/veículo mostra a **situação documental** (em dia, vencendo, vencido);
- A portaria vê o bloqueio na hora do registro — sem exceção "de boca";
- Os avisos antecipados permitem regularizar antes de travar a operação.

Prestador sem ASO não entra — e há registro de que o controle funcionou.`,
    },
    {
      slug: 'rondas-com-mapa-e-qr-code',
      title: 'Rondas: rotas, mapa da planta e QR Code por ponto',
      summary: 'Monte a rota no mapa da empresa, posicione os pontos e execute com QR.',
      tags: ['ronda', 'rota', 'checkpoint', 'mapa', 'planta', 'qr code', 'vigilante'],
      body: `## Montar a rota
1. Em **Rondas**, crie a **rota** e cadastre os **pontos de controle (checkpoints)** na ordem de passagem.
2. Clique no botão **Mapa** da rota: envie a **planta da empresa** (imagem — ela é otimizada automaticamente).
3. Para cada ponto, clique em **Posicionar** e depois clique no local exato da planta — os pontos viram **pinos numerados ligados por uma linha** que mostra o trajeto da ronda.
4. Imprima o **QR Code de cada ponto** (botão QR do pino) e fixe no local físico.

## Executar a ronda
1. O vigilante inicia a **execução da ronda** pelo celular;
2. Em cada ponto, **escaneia o QR Code** — o sistema registra a visita com hora;
3. Ao final, **finaliza** a ronda: pontos visitados e perdidos ficam registrados, e o status mostra se foi Feita, Em andamento ou Atrasada.

## Gestão
As execuções alimentam o histórico e os indicadores de segurança; pontos sistematicamente perdidos indicam rota mal dimensionada ou área com problema. Ocorrências encontradas na ronda podem ser registradas na hora.`,
    },
    {
      slug: 'ocorrencias-turno-e-custodia',
      title: 'Ocorrências, passagem de turno, chaves e correspondências',
      summary: 'Registro de ocorrências, livro eletrônico, turno com aceite e custódia de itens.',
      tags: ['ocorrencia', 'turno', 'passagem de turno', 'chave', 'correspondencia', 'livro', 'custodia'],
      body: `## Ocorrências
Registre **ocorrências** com tipo, severidade, ação imediata e responsável. Ocorrências graves podem gerar **plano de ação** vinculado. O **livro eletrônico (logbook)** guarda o registro cronológico de tudo que aconteceu no posto.

## Passagem de turno
Ao trocar o turno, o vigilante que sai registra a **passagem de turno** com o resumo (pendências, ocorrências abertas, itens em custódia) e quem entra **dá o aceite** — pendências não se perdem mais na troca.

## Chaves e materiais (custódia)
- Cadastre **chaves e materiais** sob custódia da portaria;
- Registre **empréstimo** (para quem, quando) e **devolução** — sempre se sabe com quem está a chave.

## Correspondências
Registre **correspondências e encomendas** recebidas e a **retirada** pelo destinatário — com data e responsável, eliminando extravios sem registro.`,
    },
  ],
};
