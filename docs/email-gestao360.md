# E-mail do Gestão 360 (contato@gestao360.org)

Este documento explica as duas camadas do e-mail da plataforma e como provisionar a
caixa real **contato@gestao360.org**.

## Diagnóstico de produção em 2026-07-01

- A caixa e o SMTP Titan estão cadastrados no Portal Global.
- O PostgreSQL gerenciado recebe e preserva as mensagens dos formulários públicos.
- O droplet não alcança `smtp.titan.email` nas portas 465 ou 587 porque a DigitalOcean
  bloqueia as portas SMTP 25, 465 e 587 em todos os Droplets.
- Trocar entre 465 e 587, abrir UFW ou trocar apenas a senha não resolve esse bloqueio.
- Um relay transacional com porta alternativa é necessário. A conectividade do droplet
  com `smtp.sendgrid.net:2525` foi confirmada. SendGrid é um exemplo; outro provedor que
  ofereça porta 2525 também pode ser usado.

O Titan pode continuar como caixa receptora de `contato@gestao360.org`. Para envio pela
aplicação, configure no Portal Global as credenciais do relay transacional, porta 2525,
TLS oportunista (`secure=false`) e remetente autenticado no domínio `gestao360.org`.

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
> Estado verificado em 2026-07-01: MX `mx1.titan.email`/`mx2.titan.email` e SPF
> `include:spf.titan.email`. A caixa Titan já está provisionada; não substitua seus MX
> para corrigir apenas o envio da aplicação.

### Runbook legado — Zoho Mail (não aplicado na infraestrutura atual)

Não execute este runbook sem uma decisão explícita de migrar a caixa receptora para a
Zoho. Alterar os MX removeria o recebimento atual pelo Titan.

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

### Opção A — Relay transacional para a aplicação
Mais simples e confiável (entregabilidade, antispam, DKIM automático) sem migrar a
caixa receptora do Titan:

- **SendGrid**, SMTP2GO ou outro provedor que ofereça API HTTPS ou SMTP na porta 2525.
1. Criar conta no relay e adicionar o domínio `gestao360.org`.
2. Provar a posse do domínio (registro TXT fornecido pelo provedor).
3. Verificar `contato@gestao360.org` como remetente. A caixa continua no Titan.
4. Publicar somente os registros de autenticação indicados pelo relay:
   - **Não alterar os MX** do Titan.
   - **SPF (TXT)** → mesclar o `include` do relay no único registro SPF existente.
   - **DKIM (TXT/CNAME)** → chave fornecida pelo provedor (assinatura das mensagens).
   - **DMARC (TXT)** em `_dmarc.gestao360.org` → publicar após validar SPF e DKIM.
5. No Portal Global → E-mail, preencher o SMTP **do provedor**:
   - SendGrid: `smtp.sendgrid.net`, porta `2525`, TLS/SSL direto desmarcado,
     usuário `apikey` e a API key como senha.
6. Cadastrar `contato@gestao360.org` como remetente padrão e clicar **Testar envio**.

### Opção B — Servidor de e-mail no próprio droplet (avançado)
Mais trabalhoso e sensível a bloqueios de entregabilidade. Só se houver necessidade real:

1. Instalar **mailcow** (Docker) ou **Postfix + Dovecot** no droplet.
2. Garantir **PTR (DNS reverso)** do IP `159.89.91.222` apontando para `mail.gestao360.org`
   (configurável no painel da DigitalOcean) — sem PTR, a entrega cai em spam.
3. Publicar **MX**, **SPF**, **DKIM** e **DMARC** como acima, apontando para o próprio servidor.
4. Abrir as portas 25/465/587/993 no firewall (UFW) e instalar TLS (Let's Encrypt).
5. Criar a caixa `contato@gestao360.org` e usar esse SMTP no Portal Global.

> As portas SMTP 25, 465 e 587 são bloqueadas nos Droplets da DigitalOcean. Não use esta
> opção na infraestrutura atual. Prefira um relay transacional com API HTTPS ou porta 2525.

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
submissões por minuto. A confirmação depende da gravação no PostgreSQL, que alimenta
a Caixa de Entrada do Portal Global. A notificação por e-mail é assíncrona: SMTP lento
ou indisponível não pode travar nem descartar uma solicitação já registrada.
