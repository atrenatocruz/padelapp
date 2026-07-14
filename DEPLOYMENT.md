# 🚀 Guia de Deployment - Os Padeleiros

Este guia detalha o processo completo de deployment da aplicação.

## 📋 Pré-requisitos

Antes de começar, certifica-te que tens:
- ✅ Conta no GitHub
- ✅ Conta no Supabase (gratuita)
- ✅ Conta no Vercel (gratuita)
- ✅ Node.js 18+ instalado localmente

## 🗄️ Parte 1: Configurar Supabase (Backend)

### 1.1 Criar Projeto Supabase

1. Vai a [supabase.com](https://supabase.com) e faz login
2. Clica em **New Project**
3. Preenche:
   - **Name**: os-padeleiros
   - **Database Password**: Guarda esta password!
   - **Region**: Escolhe a mais próxima (Europe West para Portugal)
4. Clica em **Create new project** e aguarda 2-3 minutos

### 1.2 Configurar Base de Dados

1. No dashboard do Supabase, vai a **SQL Editor**
2. Clica em **New query**
3. Copia todo o conteúdo do ficheiro `supabase/schema.sql`
4. Cola no editor e clica em **Run**
5. Verifica se aparece "Success" sem erros

### 1.3 Configurar Autenticação

#### Autenticação por Email (Gratuita - Recomendada)

1. Vai a **Authentication** > **Providers**
2. Ativa **Email**
3. Configura:
   - ✅ Enable Email provider
   - ✅ Confirm email: OFF (mais simples para grupos pequenos)
4. Clica em **Save**

#### Autenticação por SMS (Opcional - Requer Twilio Pago)

1. Vai a **Authentication** > **Providers**
2. Ativa **Phone**
3. Cria conta no [Twilio](https://www.twilio.com)
4. Copia as credenciais:
   - Account SID
   - Auth Token
   - Phone Number
5. Cola no Supabase e guarda

**Nota**: SMS não é necessário. Email funciona perfeitamente!

### 1.4 Obter Credenciais da API

1. Vai a **Settings** > **API**
2. Copia e guarda:
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon/public key** (chave longa começando com `eyJ...`)

**Importante**: Guarda estas credenciais num local seguro!

### 1.5 Configurar Policies de Segurança (Já incluídas no schema)

As Row Level Security (RLS) policies já estão incluídas no `schema.sql`, mas podes verificar:

1. Vai a **Authentication** > **Policies**
2. Verifica se cada tabela tem policies ativas
3. Se houver problemas, re-executa o `schema.sql`

## 🌐 Parte 2: Deploy no Vercel (Frontend)

### 2.1 Preparar Código no GitHub

1. Cria um repositório novo no GitHub
2. Faz push do código:

```bash
git init
git add .
git commit -m "Initial commit - Os Padeleiros"
git branch -M main
git remote add origin https://github.com/seu-usuario/os-padeleiros.git
git push -u origin main
```

### 2.2 Deploy no Vercel

1. Vai a [vercel.com](https://vercel.com) e faz login com GitHub
2. Clica em **Add New...** > **Project**
3. Importa o repositório do GitHub
4. Configura o projeto:
   - **Framework Preset**: Vite
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.3 Adicionar Variáveis de Ambiente

Na secção **Environment Variables**, adiciona:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxx
```

(Usa as credenciais copiadas do Supabase no passo 1.4)

### 2.4 Deploy

1. Clica em **Deploy**
2. Aguarda 2-3 minutos
3. Quando terminar, clica no link (ex: `os-padeleiros.vercel.app`)

**Parabéns! A app está online! 🎉**

## 👤 Parte 3: Criar Primeiro Admin

### 3.1 Registar Conta

1. Acede à app no link do Vercel
2. Clica em **Entrar**
3. Escolhe **Email**
4. Introduz o teu email
5. Clica em **Receber código**
6. Verifica o email e introduz o código
7. Completa o perfil com o teu nome

### 3.2 Dar Permissões de Admin

1. Volta ao dashboard do Supabase
2. Vai a **Table Editor** > **profiles**
3. Encontra o teu utilizador (pelo nome)
4. Clica na linha para editar
5. Muda `is_admin` de `false` para `true`
6. Clica em **Save**

### 3.3 Verificar Acesso Admin

1. Volta à app e faz refresh (F5)
2. Deves ver o botão **Admin** na barra inferior
3. Clica e verifica se consegues criar jogos

**Pronto! És o primeiro admin! 🎯**

## 🔧 Parte 4: Configurações Adicionais

### 4.1 Domínio Personalizado (Opcional)

Se queres usar um domínio próprio (ex: `padeleiros.pt`):

1. No Vercel, vai a **Settings** > **Domains**
2. Adiciona o teu domínio
3. Configura os DNS records conforme instruído
4. Aguarda propagação (até 48h)

### 4.2 PWA - Adicionar ao Telemóvel

Instrui os membros do grupo:

**iOS (iPhone/iPad):**
1. Abre o Safari
2. Acede ao link da app
3. Clica no ícone de partilha (quadrado com seta)
4. Clica em **Adicionar ao Ecrã Principal**
5. Confirma

**Android:**
1. Abre o Chrome
2. Acede ao link da app
3. Clica no menu (três pontos)
4. Clica em **Instalar aplicação**
5. Confirma

### 4.3 Personalizar Ícones PWA

1. Cria ícones personalizados (ver `public/ICONS_README.md`)
2. Substitui os ficheiros em `public/`
3. Faz commit e push
4. O Vercel faz deploy automático

## 📊 Parte 5: Verificações Pós-Deploy

### Checklist de Testes

Testa as seguintes funcionalidades:

- [ ] Login com email funciona
- [ ] Criar perfil funciona
- [ ] Admin consegue criar jogos
- [ ] Utilizadores conseguem ver jogos
- [ ] Utilizadores conseguem entrar em jogos
- [ ] Jogo fecha automaticamente com 4 jogadores
- [ ] Resultados podem ser registados
- [ ] Ranking é atualizado corretamente
- [ ] App funciona em telemóvel
- [ ] App funciona offline (depois de instalada)

### Resolver Problemas Comuns

**Erro: "supabase not configured"**
- Verifica se as variáveis de ambiente estão corretas no Vercel
- Faz redeploy após adicionar variáveis

**Erro: "Failed to fetch"**
- Verifica se a URL do Supabase está correta
- Verifica se o projeto Supabase está ativo

**Email OTP não chega**
- Verifica a pasta de spam
- Verifica se o email auth está ativo no Supabase
- Tenta com outro email

**Admin não tem permissões**
- Verifica se `is_admin` está `true` na tabela profiles
- Faz logout e login novamente

## 🔒 Parte 6: Segurança e Manutenção

### 6.1 Backups

O Supabase faz backups automáticos (plano gratuito: 7 dias).

Para backup manual:
1. Vai a **Database** > **Backups**
2. Clica em **Create backup**

### 6.2 Monitorização

Verifica regularmente:
- **Vercel**: Analytics e logs de erros
- **Supabase**: Usage e Database Health

### 6.3 Updates

Para atualizar a app:
1. Faz alterações no código local
2. Testa localmente com `npm run dev`
3. Faz commit e push
4. Vercel faz deploy automático

### 6.4 Limites do Plano Gratuito

**Supabase (Free Tier):**
- 500 MB database
- 1 GB bandwidth/mês
- 50 MB file storage
- **Suficiente para grupos até 50 membros**

**Vercel (Free Tier):**
- 100 GB bandwidth/mês
- Builds ilimitados
- **Suficiente para a maioria dos grupos**

Se excederes os limites, considera upgrade:
- Supabase Pro: $25/mês
- Vercel Pro: $20/mês

## 📱 Parte 7: Onboarding dos Membros

### 7.1 Preparar o Grupo

1. Cria um grupo de WhatsApp com todos os membros
2. Partilha o link da app
3. Partilha também o link das instruções

Mensagem sugerida:

```
🎾 Bem-vindos aos Padeleiros! 🎾

A nossa app para gerir jogos está pronta:
🔗 Link: https://os-padeleiros.vercel.app

📖 Instruções: https://os-padeleiros.vercel.app/instrucoes

Como começar:
1. Abre o link
2. Regista-te com o teu email
3. Completa o perfil
4. Já podes entrar em jogos!

💡 Dica: Adiciona a app ao ecrã principal do telemóvel!

Diverte-te! 🏆
```

### 7.2 Suporte Inicial

Nos primeiros dias:
- Responde rapidamente a dúvidas
- Ajuda membros com dificuldades técnicas
- Cria 2-3 jogos de teste
- Incentiva os membros a explorar

### 7.3 Promover Admins Adicionais

Quando o grupo estiver ativo:
1. Identifica 1-2 membros responsáveis
2. Promove-os a admin (ver passo 3.2)
3. Partilha o `GUIA_ADMIN_PT.md` com eles

## 🎉 Conclusão

A app está pronta a usar! 

**Próximos passos:**
1. ✅ Testa todas as funcionalidades
2. ✅ Adiciona os primeiros membros
3. ✅ Cria os primeiros jogos
4. ✅ Diverte-te a jogar! 🎾

## 🆘 Suporte

Problemas durante o deployment?

1. Consulta a secção de troubleshooting acima
2. Verifica os logs:
   - Vercel: **Deployments** > **View Logs**
   - Supabase: **Logs** > **API Logs**
3. Procura o erro no Google/Stack Overflow
4. Abre um issue no GitHub

---

**Bom deployment! 🚀**

Para dúvidas, consulta:
- README.md
- GUIA_ADMIN_PT.md
- Documentação Supabase: [docs.supabase.com](https://docs.supabase.com)
- Documentação Vercel: [vercel.com/docs](https://vercel.com/docs)


