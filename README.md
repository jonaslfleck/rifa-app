# App Camboatá v4 — DTG Camboatá

## O que mudou na v4

### UX completamente reformulada
- **Tela de login dedicada** ao abrir o app sem sessão — exibe logo, modo telefone e modo equipe
- **Tela de boas-vindas** pós-login com: último acesso, comandas em aberto, calendário das próximas jantas
- **Menu dropdown agrupado por categoria** (funciona em todas as telas, incluindo desktop):
  - **Início** → Início
  - **Jantas** → Janta atual · Histórico · Calendário
  - **Cadastros** → Dançarinos · Pais/Responsáveis · Usuários equipe · Acessos
  - **Financeiro** → Caixa · Comandas · Conferência de baixa
  - **Relatórios** → Dashboard · Aniversários · Cardápio imprimível · Logs
- **Botão fechar (×) em todas as modais**, com mesma ação de Cancelar
- **Modal de perfil** no avatar do topbar para logout

### Novas funcionalidades
- **Pais e Responsáveis** — aba dedicada derivada dos dados dos dançarinos
- **Comandas separado do Caixa** — tab própria; pais veem **apenas** as suas e dos seus filhos
- **Conferência de baixa** — marcar presença e arquivar janta em tab exclusiva
- **Janta de doação** — checkbox no formulário de edição; quando marcado, saldo = arrecadado (gasto não é descontado)
- **Histórico de jantas** dentro do menu Jantas (não mais separado)
- **Export Excel/TSV** não exibido para pais
- **Cardápio imprimível** com escala maior e mais legível

### Separação de acesso
| Role | Vê Comandas | Vê outras comandas | Vê Caixa | Vê Excel |
|---|---|---|---|---|
| super/diretoria/tesouraria | ✅ todas | ✅ | ✅ | ✅ |
| pai/org | ✅ próprias + filhos | ❌ | ❌ | ❌ |

## Setup

```bash
npm install
cp .env.example .env
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## Banco de dados

Execute `migration.sql` no SQL Editor do Supabase.

Para atribuir papel a um usuário após criação:
```sql
select assign_role('email@dtg.com.br', 'super');
```
