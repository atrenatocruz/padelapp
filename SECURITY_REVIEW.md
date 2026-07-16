# Auditoria de Segurança — padel.app

**Data:** 2026-07-16
**Âmbito:** revisão completa do projeto (schema SQL/RLS, triggers, funções, autenticação, páginas com escritas na BD, histórico git, dependências).
**Contexto:** o modelo de segurança desta app assenta 100% nas policies RLS do Supabase — a chave `anon` está no bundle JS e qualquer pessoa pode falar diretamente com a API REST do Supabase, ignorando a UI. Todos os pontos abaixo devem ser avaliados por essa lente.

**Estado:** ⬜ por corrigir · ✅ corrigido

---

## 🔴 Críticas (corrigir antes de ter utilizadores reais)

### 1. ⬜ Qualquer utilizador pode tornar-se admin sozinho

A policy `"Users can update own profile"` (`supabase/schema.sql:89`) permite UPDATE à própria linha sem restringir colunas. Como `is_admin` vive na tabela `profiles`, qualquer utilizador autenticado pode correr na consola do browser:

```js
await supabase.from('profiles').update({ is_admin: true }).eq('id', meuId)
```

e passa a poder apagar utilizadores (`admin_delete_user`), gerir jogos, tudo.

**Fix pragmático:** trigger `BEFORE UPDATE` em `profiles` que faz `RAISE EXCEPTION` se `is_admin` (ou `is_guest`) mudar e o chamador não for admin. ~10 linhas de SQL, custo zero.

**Nota relacionada:** o botão "Tornar admin" em `src/pages/Admin.jsx:242` hoje **falha silenciosamente** para outros utilizadores — não existe policy que deixe um admin atualizar perfis de terceiros (0 linhas afetadas, sem erro). Ou seja, a única forma de promover admins que funciona é a própria falha acima. O fix correto é um RPC `SECURITY DEFINER` tipo `admin_set_admin(user_id, valor)` com guard de admin, no mesmo estilo do `admin_delete_user` já existente.

### 2. ⬜ Dados pessoais de todos os membros expostos publicamente à internet

`"Public profiles are viewable by everyone"` com `USING (true)` (`schema.sql:85`) significa que **qualquer pessoa, sem login**, com a anon key (extraível do bundle em segundos) lê nome, **email, telefone, data de nascimento e género** de todos os membros. Para uma app com dados pessoais na UE isto é diretamente um problema de RGPD. A nota no `migration_guests.sql` justificava isto pelos convidados, mas o guest login já foi removido.

**Fix pragmático (2 níveis):**

- **Mínimo:** mudar o SELECT para `USING (auth.uid() IS NOT NULL)` — só membros autenticados veem perfis.
- **Ideal (barato):** manter `email/phone/birthday` visíveis só ao próprio (`auth.uid() = id`) e criar uma view `profiles_public` (id, name, level, gender, preferred_side, is_guest) para tudo o que a app mostra sobre os outros. Requer ajustar os selects no frontend — trabalho de uma tarde.

---

## 🟠 Altas

### 3. ⬜ Bug de scoping na policy de resultados

Em `schema.sql:161`, `WHERE participants.game_id = game_id` compara a coluna consigo própria (o `game_id` não qualificado resolve para o da própria tabela `participants`), logo é sempre verdade: qualquer utilizador que participe em *qualquer* jogo pode submeter resultados para *todos* os jogos.

**Fix:** qualificar como `participants.game_id = results.game_id`.

### 4. ⬜ Desligar "Allow anonymous sign-ins" no dashboard Supabase

O guest login saiu da UI, mas se o toggle ficou ligado, qualquer pessoa cria sessões anónimas via API e passa nos checks `auth.uid() IS NOT NULL` (pode inserir-se em `participants`, por exemplo).

**Fix:** Dashboard → Authentication → Sign In / Providers → desligar "Allow anonymous sign-ins". Um clique.

---

## 🟡 Médias

### 5. ⬜ Dependências vulneráveis

`npm audit` reporta 21 vulnerabilidades (13 high), das quais 4 high em produção (`ws`, `@remix-run/router` via react-router 6.20).

**Fix:** `npm audit fix` + subir `react-router-dom` resolve a maioria sem breaking changes; o resto é tooling de dev (vite 5), menos urgente.

### 6. ⬜ Headers de segurança ausentes

O `vercel.json` só tem rewrites.

**Fix:** adicionar `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e HSTS — ~15 linhas de JSON, custo zero. Um CSP básico é bónus (atenção: precisa de permitir Google Fonts e o domínio do Supabase).

### 7. ⬜ Funções `SECURITY DEFINER` sem `SET search_path`

`finalize_mix`, `admin_delete_user`, `handle_new_user`, `check_game_reopen` deviam ter `SET search_path = public` (hardening standard que o próprio linter do Supabase recomenda; evita hijacking via schemas maliciosos).

### 8. ⬜ Triggers a esbarrar no RLS (bugs funcionais com raiz em segurança)

`update_player_stats` e `check_game_full` não são `SECURITY DEFINER`, por isso correm com as permissões do utilizador que os dispara:

- o INSERT em `player_stats` (que não tem policy de INSERT) faz **falhar a transação inteira** quando um não-admin submete um resultado no fluxo antigo de `results`;
- o auto-fechar de jogos em `games` falha silenciosamente para não-admins.

**Fix:** se o fluxo antigo de `results` ainda é usado, tornar estes triggers `SECURITY DEFINER` (como já foi feito com `check_game_reopen`).

---

## 🟢 Baixas / opcionais

### 9. ⬜ `participants` sem `WITH CHECK` fino

Um utilizador pode inscrever-se já com `status='confirmed'` e atribuir qualquer pessoa como `partner_id` sem consentimento. Num grupo de amigos é aceitável — só corrigir se aparecer abuso.

### 10. ⬜ Configuração do dashboard Supabase

Confirmar email ligado, password mínima ≥ 8 caracteres, e rever os rate limits default de auth. Grátis, só configuração.

---

## ✅ O que está bem (não mexer)

- **Anon key no bundle e placeholders no `INSTALLATION.md`** — é o modelo normal do Supabase; **não há segredos reais no git** (histórico completo verificado).
- **Bypass "Entrar como Admin (dev)"** — corretamente gated por `import.meta.env.DEV` (não entra no build de produção) e é só ilusão client-side: sem JWT real, o RLS bloqueia tudo.
- **`admin_delete_user` e `finalize_mix`** — bem desenhados (guard de admin, `REVOKE` de anon, transacional).
- **XSS** — React escapa output por defeito e não há `dangerouslySetInnerHTML`; risco baixo.

---

## Prioridade sugerida

| Ordem | Pontos | Esforço | Impacto |
|-------|--------|---------|---------|
| 1 | #1, #3, #4 | ~30 min | Fecha as portas graves (escalada de privilégios, escrita indevida) |
| 2 | #2 | meio dia (nível ideal) | Protege dados pessoais / RGPD |
| 3 | #5, #6, #7, #8 | 1–2 h | Higiene incremental |
| 4 | #9, #10 | opcional | Endurecimento extra |

Tudo dentro do free tier, sem custos novos.
