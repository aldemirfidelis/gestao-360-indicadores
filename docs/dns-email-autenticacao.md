# Autenticação de e-mail do domínio gestao360.org

> **Problema:** e-mails enviados pela plataforma (status de candidatura, solicitação
> de demonstração, alertas, recuperação de senha) estão caindo em spam.
>
> **Causa:** a aplicação envia pelo **Brevo**, mas o DNS autoriza apenas o **Titan**.
> Toda mensagem chega ao destinatário falhando SPF e sem assinatura DKIM.

---

## 1. Diagnóstico (verificado em 27/07/2026)

| Item | Estado atual | Consequência |
|---|---|---|
| SPF | `v=spf1 include:spf.titan.email ~all` | Brevo **não autorizado** → SPF falha |
| DKIM | Nenhum seletor publicado | Mensagem **sem assinatura** |
| DMARC | Não existe | Sem política; receptor decide sozinho (e decide mal) |
| MX | `mx1.titan.email` / `mx2.titan.email` | Correto — as caixas ficam no Titan |

**Como a aplicação envia hoje** (configuração de produção):

- Servidor: `smtp-relay.brevo.com`, porta `2525`
- Remetente: `Gestão 360 <contato@gestao360.org>`

A porta 2525 é usada porque a DigitalOcean bloqueia as portas 25, 465 e 587 de saída.

> **Ponto central:** o remetente é `@gestao360.org`, mas quem entrega é o Brevo.
> Para o Gmail/Outlook, isso é uma mensagem que *afirma* ser do seu domínio vinda de
> um servidor que o seu domínio **não autorizou** — o padrão de phishing. Desde
> fevereiro de 2024 os grandes provedores **exigem** autenticação; sem ela, não
> adianta esperar a reputação melhorar.

---

## 2. Correção — 3 passos no painel de DNS

O domínio usa Titan para receber e Brevo para enviar. Os dois precisam conviver.

### Passo 1 — Autenticar o domínio no Brevo (gera o DKIM)

1. Acesse o painel do Brevo → **Settings → Senders, Domains & Dedicated IPs → Domains**
2. Clique em **Authenticate this domain** em `gestao360.org`
3. O Brevo mostrará **3 registros** para publicar. Eles são **específicos da sua conta**
   — os valores abaixo são o formato, não os valores reais:

| Tipo | Nome/Host | Valor |
|---|---|---|
| TXT | `brevo-code` | `<código que o Brevo mostrar>` |
| TXT | `mail._domainkey` | `k=rsa;p=<chave pública que o Brevo mostrar>` |
| TXT | `_dmarc` | (ver Passo 3 — publique o nosso, não o do Brevo) |

Publique os dois primeiros exatamente como o Brevo apresentar.

### Passo 2 — Corrigir o SPF (autorizar Titan **e** Brevo)

O registro TXT da raiz do domínio precisa **substituir** o valor atual por:

```
v=spf1 include:spf.titan.email include:spf.brevo.com ~all
```

⚠️ **Não crie um segundo registro SPF.** Um domínio só pode ter **um** registro
`v=spf1`; dois registros invalidam a verificação inteira. É preciso editar o
existente, acrescentando `include:spf.brevo.com` antes do `~all`.

### Passo 3 — Criar o DMARC

Crie um registro TXT novo:

| Campo | Valor |
|---|---|
| Tipo | TXT |
| Nome/Host | `_dmarc` |
| Valor | `v=DMARC1; p=none; rua=mailto:contato@gestao360.org; fo=1` |

**Comece com `p=none`.** Essa política não bloqueia nada — apenas pede aos
provedores que enviem relatórios do que está acontecendo. É o modo seguro de
observar por 2 a 4 semanas antes de endurecer.

Depois que os relatórios mostrarem SPF e DKIM passando de forma consistente,
evolua a política:

```
v=DMARC1; p=quarantine; rua=mailto:contato@gestao360.org; fo=1   (2ª fase)
v=DMARC1; p=reject;     rua=mailto:contato@gestao360.org; fo=1   (3ª fase)
```

Não pule direto para `p=reject`: se algum remetente legítimo ainda não estiver
autenticado, as mensagens dele passam a ser **rejeitadas de vez**.

---

## 3. Como verificar se funcionou

A propagação leva de alguns minutos a algumas horas. Depois disso:

```powershell
# SPF deve listar titan E brevo
Resolve-DnsName gestao360.org -Type TXT | Select-Object -ExpandProperty Strings

# DKIM deve retornar a chave pública
Resolve-DnsName mail._domainkey.gestao360.org -Type TXT

# DMARC deve retornar a política
Resolve-DnsName _dmarc.gestao360.org -Type TXT
```

**Teste ponta a ponta (o que realmente importa):**

1. No painel do Brevo, confirme que o domínio aparece como **Authenticated**
2. Envie um e-mail real pela plataforma (ex.: formulário `/demonstracao`)
3. No Gmail, abra a mensagem → menu ⋮ → **Mostrar original**. Deve constar:

```
SPF:   PASS
DKIM:  PASS
DMARC: PASS
```

Se os três derem PASS, o problema está resolvido.

---

## 4. Onde isso afeta o produto

Todos os envios saem pelo mesmo caminho
(`common/smtp.ts` → `resolveSmtpConfig`), então a correção vale para todos de uma vez:

- **Recrutamento** — status de candidatura, convite para entrevista, proposta,
  pré-admissão (`recruit-communication.service.ts`)
- **Comercial** — solicitação de demonstração e contato do site
  (`public-contact.service.ts` → `contato@gestao360.org`)
- **Comunicação Interna** — aviso por e-mail de publicação, quando marcado
- **Plataforma** — alertas, convites e recuperação de senha
- **Suporte** — tickets

---

## 5. Boas práticas depois de autenticar

- **Não troque o remetente por um endereço de outro domínio** (`@gmail.com`,
  `@outlook.com`). Isso quebra o alinhamento DMARC e volta tudo para o spam.
- **Mantenha o `contato@gestao360.org` como caixa real e monitorada** — receptor
  que envia para um endereço que dá bounce perde reputação.
- Se um dia trocar o Brevo por outro provedor (Resend, SES, Titan SMTP), é
  obrigatório **atualizar o SPF e publicar o DKIM do novo provedor** antes de virar
  a chave.
- O código já suporta provedor por API HTTPS (Resend/Brevo) via
  `RESEND_API_KEY`/`BREVO_API_KEY` — mas isso **não substitui** a autenticação de
  DNS. Independentemente do canal, o domínio precisa autorizar quem envia.
