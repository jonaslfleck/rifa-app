# Rifa App — Deploy com Supabase + Vercel

## Stack
- **Next.js 14** (App Router)
- **Supabase** — banco de dados PostgreSQL + autenticação Google OAuth + realtime
- **Vercel** — hospedagem

---

## 1. Supabase

### 1.1 Criar projeto
1. Acesse https://supabase.com e crie um novo projeto
2. Guarde a **URL** e a **anon key** (Settings > API)
3. Guarde também a **service_role key** (usada nas API routes)

### 1.2 Executar a migration
No Supabase Dashboard, vá em **SQL Editor** e cole o conteúdo de:
```
supabase/migrations/001_schema.sql
```
Clique em **Run**.

### 1.3 Configurar Google OAuth
1. Acesse https://console.cloud.google.com
2. Crie um projeto > APIs & Services > Credentials > Create OAuth 2.0 Client ID
3. Em **Authorized redirect URIs**, adicione:
   ```
   https://<seu-projeto>.supabase.co/auth/v1/callback
   ```
4. No Supabase: **Authentication > Providers > Google**
5. Cole o **Client ID** e **Client Secret** do Google
6. Ative o provider

---

## 2. Variáveis de ambiente

Crie um arquivo `.env.local` na raiz:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

---

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse:
- `http://localhost:3000` — página pública da rifa
- `http://localhost:3000/admin` — painel admin

---

## 4. Deploy na Vercel

### 4.1 Via CLI
```bash
npm i -g vercel
vercel
```

### 4.2 Via GitHub (recomendado)
1. Faça push para um repositório GitHub
2. Acesse https://vercel.com/new e importe o repositório
3. Em **Environment Variables**, adicione as três variáveis do `.env.local`
4. Clique em **Deploy**

### 4.3 Atualizar redirect URI do Google
Após o deploy, adicione a URL da Vercel no Google Console:
```
https://<seu-app>.vercel.app/auth/callback
```
E no Supabase: **Authentication > URL Configuration > Redirect URLs**, adicione:
```
https://<seu-app>.vercel.app/auth/callback
```

---

## 5. Primeiro acesso admin

1. Acesse `/admin` e faça login com Google
2. Será redirecionado para `/admin/unauthorized` (seu e-mail ainda não está na lista)
3. No Supabase SQL Editor, rode:
   ```sql
   update rifas set admin_emails = array['seu@gmail.com'];
   ```
4. Acesse `/admin` novamente — agora terá acesso

---

## Estrutura do projeto

```
src/
  app/
    page.tsx              ← página pública da rifa
    admin/
      page.tsx            ← painel admin (protegido)
      login/page.tsx      ← login com Google
      unauthorized/page.tsx
    auth/callback/route.ts ← callback OAuth
    api/
      rifa/route.ts       ← PATCH config da rifa
      reservas/route.ts   ← PATCH confirmar/cancelar
  components/
    RifaClient.tsx        ← grid de números + modal Pix
    AdminClient.tsx       ← painel admin completo
  lib/
    supabase/
      client.ts           ← cliente browser
      server.ts           ← cliente server + service role
    pix.ts                ← gerador de payload EMV
    types.ts              ← tipos TypeScript
supabase/
  migrations/
    001_schema.sql        ← schema do banco
```
