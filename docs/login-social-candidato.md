# Login social do candidato (Google e LinkedIn)

O portal `/candidato` aceita entrada por Google e LinkedIn além de e-mail e senha.

**Os botões só aparecem quando as credenciais estão configuradas no servidor.**
Sem `GOOGLE_OAUTH_CLIENT_ID`/`SECRET`, o botão do Google não é renderizado — em
vez de existir e quebrar no clique. O mesmo vale para o LinkedIn. Enquanto
nenhum dos dois estiver configurado, a tela funciona normalmente só com e-mail e
senha, sem nenhum espaço vazio.

## Variáveis de ambiente

No `.env` da API (no droplet, `/opt/gestao-360-indicadores/.env`):

```bash
GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=...
LINKEDIN_OAUTH_CLIENT_ID=...
LINKEDIN_OAUTH_CLIENT_SECRET=...
```

Depois de editar, reinicie o container da API para o processo enxergar as
variáveis novas.

## URLs de callback

Precisam ser cadastradas **exatamente** assim no painel de cada provedor —
qualquer diferença (barra final, http em vez de https) faz o provedor recusar:

| Provedor | URL de redirecionamento autorizada |
| --- | --- |
| Google | `https://gestao360.org/api/careers/candidates/oauth/google/callback` |
| LinkedIn | `https://gestao360.org/api/careers/candidates/oauth/linkedin/callback` |

Em desenvolvimento, troque a base por `http://localhost:3000` (o valor sai de
`PUBLIC_SITE_URL`/`NEXT_PUBLIC_SITE_URL`).

## Google — passo a passo

1. <https://console.cloud.google.com/> → crie ou selecione um projeto.
2. **APIs e serviços → Tela de permissão OAuth**: tipo **Externo**, preencha
   nome do app, e-mail de suporte e domínio `gestao360.org`.
3. Escopos: `openid`, `email`, `profile` (os três básicos, nada sensível — não
   exige verificação do Google).
4. **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo
   **Aplicativo da Web**.
5. Em *URIs de redirecionamento autorizados*, cole a URL do Google da tabela.
6. Copie o **ID do cliente** e a **Chave secreta** para o `.env`.
7. Publique a tela de permissão (enquanto ficar em "Teste", só contas listadas
   conseguem entrar).

## LinkedIn — passo a passo

1. <https://www.linkedin.com/developers/apps> → **Create app** (exige uma
   Company Page da empresa).
2. Aba **Products** → adicione **Sign In with LinkedIn using OpenID Connect**.
   É o produto atual; o "Sign In with LinkedIn" antigo está descontinuado e não
   devolve e-mail no mesmo endpoint.
3. Aba **Auth** → *Authorized redirect URLs* → cole a URL do LinkedIn da tabela.
4. Copie **Client ID** e **Client Secret** para o `.env`.
5. Confirme que os escopos `openid`, `profile` e `email` aparecem liberados na
   aba Auth.

## Como o vínculo de conta funciona

1. **Identidade já registrada** (`provider` + id do provedor) → entra na conta
   ligada. O vínculo é pelo id, não pelo e-mail: o e-mail pode mudar na conta de
   origem, o id não.
2. **Sem identidade, mas com e-mail verificado pelo provedor** → o candidato
   existente com aquele e-mail recebe a identidade nova e passa a poder entrar
   pelos dois caminhos.
3. **Nada encontrado** → cria a conta já com e-mail verificado.

Se o provedor **não confirmar** o e-mail, o login é recusado com orientação para
usar e-mail e senha. Sem essa trava, bastaria criar uma conta social com o
e-mail de outra pessoa para assumir a candidatura dela.

## Detalhes de segurança

- O `state` é um JWT assinado com o segredo do candidato, válido por 10 minutos,
  e o provedor é conferido na volta (anti-CSRF).
- O destino pós-login só aceita caminho interno; `?returnTo=https://site-falso`
  cai no padrão `/candidato`, para o callback não virar redirect aberto.
- O token de sessão volta no **fragmento** da URL (`#token=…`), que não é enviado
  ao servidor nem gravado em log de acesso ou `Referer`. A página consome e
  limpa a barra de endereços em seguida.

## Tabela

`recruit_candidate_identities` — migração
`20260727235000_candidate_social_identity`. Um candidato pode ter as duas
identidades; `(provider, providerAccountId)` é único.

---

# Compartilhar vaga no LinkedIn

Botão na tela da vaga publicada (`/recrutamento/vagas/{id}`), ao lado de
"Página pública". Só aparece com a vaga em `PUBLISHED` — não faz sentido
divulgar rascunho.

## O que o LinkedIn aceita (e o que não aceita)

**Não dá para pré-preencher o texto do post.** Os parâmetros `title`/`summary`
do endpoint de compartilhamento são legado e hoje são ignorados: o LinkedIn
monta o card lendo as tags **Open Graph** da página da vaga, e o comentário é
sempre digitado pela pessoa.

Por isso o botão faz duas coisas:

1. abre o compositor do LinkedIn já com a URL da vaga — o card sai pronto
   (cargo, empresa, cidade, banner) porque a página tem OG por vaga;
2. mostra um **texto sugerido** editável e copia para a área de transferência,
   para o recrutador colar como comentário do post.

## De onde vem o card

`generateMetadata` em `apps/web/app/carreiras/vagas/[slug]/page.tsx` (server
component; o conteúdo interativo ficou em
`components/careers/vacancy-detail.tsx`). Busca a vaga pela API interna
(`INTERNAL_API_URL`, com `revalidate: 3600` — robôs de link batem várias vezes)
e monta `og:title`, `og:description`, `og:image` e canonical. Falha na busca
nunca derruba a página: cai numa metadata padrão.

A imagem do card é o **banner da página de carreiras** da empresa (ou o logo, se
não houver banner), em URL absoluta — o robô do LinkedIn não baixa caminho
relativo. Empresa sem banner nem logo compartilha sem imagem, o que o LinkedIn
renderiza como card compacto.

## Depurar o card

O LinkedIn guarda o card em cache agressivo. Para forçar releitura depois de
mudar a vaga, use o **Post Inspector**: <https://www.linkedin.com/post-inspector/>
— cole a URL da vaga e clique em "Inspect".
