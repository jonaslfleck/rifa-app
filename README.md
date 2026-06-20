# Rifa App — Deploy com Supabase + Vercel

## Stack
- **Next.js 14** (App Router)
- **Supabase** — banco de dados PostgreSQL + autenticação por email/senha + realtime
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

### 1.3 Criar os usuários admin (email/senha)
1. No Supabase: **Authentication > Users > Add user > Create new user**
2. Informe o **email** (ex.: `tjfleck@gmail.com`) e uma **senha**
3. Marque **Auto Confirm User**
4. Repita para cada admin
5. (Opcional, recomendado) Desative o cadastro público em
   **Authentication > Sign In / Providers > Email > Allow new users to sign up**

> A autorização é feita pela lista `admin_emails` da rifa: mesmo logado, quem
> não estiver na lista cai em `/admin/unauthorized`.

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

> A autenticação é por email/senha (não usa OAuth), então não há redirect URIs
> a configurar na Vercel.

---

## 5. Primeiro acesso admin

1. Crie seu usuário em **Authentication > Users** (ver passo 1.3)
2. Garanta que seu email está na lista de admins:
   ```sql
   update rifas set admin_emails = array['seu@gmail.com'];
   ```
3. Acesse `/admin/login`, entre com email e senha — terá acesso ao painel

---

## Estrutura do projeto

```
src/
  app/
    page.tsx              ← página pública da rifa
    admin/
      page.tsx            ← painel admin (protegido)
      login/page.tsx      ← login por email/senha
      unauthorized/page.tsx
    api/
      rifa/route.ts       ← PATCH config da rifa
      reservas/route.ts   ← PATCH confirmar/cancelar
      notificar/route.ts  ← POST email aos admins na reserva
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
