# E-mail do Gestão 360 (contato@gestao360.org)

Este documento explica as duas camadas do e-mail da plataforma e como provisionar a
caixa real **contato@gestao360.org**.

## 1. O que já está pronto no produto (camada de aplicação)

No **Portal Administrativo Global** (`/platform-admin`) → menu **Técnico → E-mail** o Super
Admin configura, sem mexer em código:

- **Servidor SMTP**: host, porta, TLS, usuário, senha (cifrada em AES-256-GCM), remetente
  padrão (From), nome de exibição e Reply-To. Botão **Testar envio**.
- **Remetentes do sistema**: cadastro de endereços remetentes (ex.: `contato@gestao360.org`,
  `nao-responda@gestao360.org`) com um marcado como **padrão** (★).

O envio real (convites de reunião e notificações) passou a ler essa configuração do banco,
com **fallback** para as variáveis de ambiente `SMTP_*` (compatibilidade com o que já existia).

> A senha **nunca** volta ao frontend — a tela mostra apenas um marcador `••••••`. Para
> trocar, digite a nova senha; para manter, deixe o campo como está.

### Persistência
- Tabelas `PortalEmailSetting` e `PortalMailbox` (migration `20260622193000_portal_email_config`).
- Chave de cifra: `INTEGRATIONS_SECRET` (ou, na ausência, derivada de `JWT_ACCESS_SECRET`).

## 2. Provisionar a caixa real (camada de infraestrutura)

A tela acima faz o sistema **enviar** como `contato@gestao360.org`. Para a caixa também
**receber** mensagens e permitir login, é preciso uma caixa de e-mail de verdade — isso
depende de provedor + DNS, **não** de código.

> **DNS do domínio:** `gestao360.org` é gerenciado na **DigitalOcean** (ns1/ns2/ns3.digitalocean.com).
> Os registros abaixo são adicionados em **DigitalOcean → Networking → Domains → gestao360.org**.
> Estado atual (2026-06-24): **sem MX e sem SPF** — e-mail ainda não provisionado.

### Runbook ESCOLHIDO — Zoho Mail (plano gratuito) + DNS na DigitalOcean

1. **Criar conta** em https://www.zoho.com/mail/ → escolher o **Forever Free Plan** e **adicionar o domínio** `gestao360.org`.
2. **Verificar a posse**: a Zoho dá um registro **TXT** (ex.: host `zb******` ou `@` com valor `zoho-verification=zb******.zmverify.zoho.com`). Adicione na DigitalOcean (Type TXT) e clique em *Verify* na Zoho.
3. **Criar a caixa** `contato@gestao360.org` (e, se quiser, `nao-responda@gestao360.org`).
4. **Publicar os registros DNS** na DigitalOcean:
   - **MX** (Hostname `@`):
     - `mx.zoho.com` — prioridade **10**
     - `mx2.zoho.com` — prioridade **20**
     - `mx3.zoho.com` — prioridade **50**
   - **SPF (TXT, host `@`)**: `v=spf1 include:zoho.com ~all`
   - **DKIM (TXT)**: na Zoho, *Email Configuration → DKIM → Add*, selector `zoho` → ela gera o valor; publique como TXT no host `zoho._domainkey` com o valor fornecido.
   - **DMARC (TXT, host `_dmarc`)**: `v=DMARC1; p=quarantine; rua=mailto:contato@gestao360.org`
5. **SMTP no Portal Global → Técnico → E-mail** (para o app ENVIAR como contato@):
   - Host `smtp.zoho.com` · Porta `465` (TLS marcado) **ou** `587` · Usuário `contato@gestao360.org`
   - Senha: gere uma **senha de aplicativo** na Zoho (Perfil → Security → App Passwords) — recomendado com 2FA ligado.
   - From: `Gestão 360 <contato@gestao360.org>` · Remetente padrão = `contato@gestao360.org`.
   - Clique **Testar envio**.
   > **Atenção (plano gratuito):** a Zoho às vezes restringe **SMTP/IMAP** ao plano pago **Mail Lite** (~US$1/usuário/mês). Se o "Testar envio" falhar com erro de autenticação/IMAP-POP desativado, ative *IMAP/SMTP Access* nas configurações da caixa ou faça upgrade para o Mail Lite. O recebimento/webmail funciona no gratuito.
6. **Checklist final**: MX/SPF/DKIM/DMARC propagados (pode levar até algumas horas) → "Testar envio" verde no Portal Global.

### Opção A — Provedor gerenciado (genérico)
Mais simples e confiável (entregabilidade, antispam, DKIM automático):

- **Zoho Mail** (tem plano gratuito para domínio próprio) ou **Google Workspace** / **Microsoft 365**.
1. Criar conta no provedor e adicionar o domínio `gestao360.org`.
2. Provar a posse do domínio (registro TXT fornecido pelo provedor).
3. Criar a caixa `contato@gestao360.org` (e outras, ex.: `nao-responda@`).
4. Publicar os registros DNS indicados pelo provedor:
   - **MX** → servidores de entrada do provedor (ex.: `mx.zoho.com`, prioridade 10).
   - **SPF (TXT)** → ex.: `v=spf1 include:zoho.com ~all` (ou `include:_spf.google.com`).
   - **DKIM (TXT/CNAME)** → chave fornecida pelo provedor (assinatura das mensagens).
   - **DMARC (TXT)** em `_dmarc.gestao360.org` → ex.: `v=DMARC1; p=quarantine; rua=mailto:contato@gestao360.org`.
5. No Portal Global → E-mail, preencher o SMTP **do provedor**:
   - Zoho: `smtp.zoho.com`, porta `465` (TLS) ou `587`, usuário `contato@gestao360.org` + senha de app.
   - Google: `smtp.gmail.com`, porta `465`/`587`, usuário + **senha de app** (com 2FA).
6. Cadastrar `contato@gestao360.org` como remetente padrão e clicar **Testar envio**.

### Opção B — Servidor de e-mail no próprio droplet (avançado)
Mais trabalhoso e sensível a bloqueios de entregabilidade. Só se houver necessidade real:

1. Instalar **mailcow** (Docker) ou **Postfix + Dovecot** no droplet.
2. Garantir **PTR (DNS reverso)** do IP `159.89.91.222` apontando para `mail.gestao360.org`
   (configurável no painel da DigitalOcean) — sem PTR, a entrega cai em spam.
3. Publicar **MX**, **SPF**, **DKIM** e **DMARC** como acima, apontando para o próprio servidor.
4. Abrir as portas 25/465/587/993 no firewall (UFW) e instalar TLS (Let's Encrypt).
5. Criar a caixa `contato@gestao360.org` e usar esse SMTP no Portal Global.

> A porta 25 de saída costuma ser bloqueada por padrão na DigitalOcean; é preciso solicitar
> liberação ao suporte. Por isso a **Opção A** é a recomendada.

## 3. Checklist rápido
- [ ] Domínio `gestao360.org` adicionado no provedor e verificado
- [ ] Caixa `contato@gestao360.org` criada
- [ ] DNS: MX, SPF, DKIM, DMARC publicados e propagados
- [ ] SMTP do provedor preenchido no Portal Global → E-mail
- [ ] `contato@gestao360.org` definido como remetente padrão
- [ ] **Testar envio** retornou sucesso

## 4. Formulários públicos

Os formulários de contato, suporte e trial enviam pela API usando a mesma
configuração SMTP do Portal Global. Os destinatários não vêm do navegador:

- suporte, acesso, SAC e LGPD → `PUBLIC_SUPPORT_EMAIL` (padrão
  `suporte@gestao360.org`);
- comercial, demonstração e trial → `PUBLIC_CONTACT_EMAIL` (padrão
  `contato@gestao360.org`).

O endpoint público aplica validação, campo-isca antispam e limite de cinco
submissões por minuto. Se o SMTP não estiver configurado ou falhar, o formulário
informa que o canal está indisponível e não apresenta uma confirmação falsa.
