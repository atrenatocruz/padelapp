# 📋 Guia do Administrador - Os Padeleiros

Bem-vindo ao guia completo para administradores da app "Os Padeleiros".

## 🎯 Responsabilidades do Admin

Como administrador, podes:
- ✅ Criar, editar e eliminar jogos
- ✅ Gerir membros e permissões
- ✅ Confirmar resultados
- ✅ Configurar definições do grupo
- ✅ Ver estatísticas e ranking

## 🚀 Primeiros Passos

### 1. Aceder ao Painel Admin

1. Entra na app com a tua conta
2. Clica no ícone ⚙️ **Admin** na barra inferior
3. Verás três separadores: **Jogos**, **Membros** e **Definições**

## 📅 Gerir Jogos

### Criar um Novo Jogo

1. Vai ao separador **Jogos**
2. Clica em **Criar novo jogo**
3. Preenche os campos:
   - **Título**: Nome do jogo (ex: "Mix de Domingo")
   - **Data e hora**: Quando vai ser o jogo
   - **Local**: Onde vai ser (ex: "Clube de Padel Lisboa")
   - **Nº máximo de jogadores**: Normalmente 4
4. Clica em **Criar**

**Dica**: Cria jogos com antecedência para os membros se organizarem!

### Editar um Jogo

1. Encontra o jogo na lista
2. Clica no ícone ✏️ (editar)
3. Altera os campos necessários
4. Clica em **Atualizar**

**Nota**: Se já houver jogadores inscritos, avisa-os da alteração!

### Eliminar um Jogo

1. Encontra o jogo na lista
2. Clica no ícone 🗑️ (eliminar)
3. Confirma a eliminação

**Atenção**: Esta ação não pode ser desfeita!

### Estados dos Jogos

- 🔵 **Aberto**: Jogadores podem entrar
- 🟢 **Fechado**: 4 jogadores confirmados, campo reservado
- ⚪ **Terminado**: Jogo já foi realizado
- 🔴 **Cancelado**: Jogo foi cancelado

## 👥 Gerir Membros

### Ver Lista de Membros

1. Vai ao separador **Membros**
2. Vês todos os membros do grupo com:
   - Nome e nível
   - Contacto
   - Estatísticas (jogos e vitórias)
   - Estado de admin

### Promover/Remover Admin

1. Encontra o membro na lista
2. Clica em **Tornar admin** ou **Remover admin**
3. Confirma a alteração

**Importante**: Escolhe admins de confiança que ajudem a gerir o grupo!

### Remover Membros

Atualmente não é possível remover membros pela app. Se necessário:
1. Vai ao painel do Supabase
2. Table Editor > profiles
3. Elimina o utilizador

## ⚙️ Configurar Definições

### Editar Nome do Grupo

1. Vai ao separador **Definições**
2. Altera o campo **Nome do grupo**
3. Clica em **Guardar definições**

### Adicionar Contacto do Robot

1. Vai ao separador **Definições**
2. Adiciona o número no campo **Contacto do Robot**
3. Clica em **Guardar definições**

**Nota**: Este campo é apenas informativo. Notificações automáticas não estão ativas.

## 🏆 Gerir Resultados

### Como Funcionam os Resultados

1. Após um jogo, qualquer jogador participante pode registar o resultado
2. O resultado é guardado automaticamente
3. As estatísticas de todos os jogadores são atualizadas
4. O ranking é recalculado

### Ver Resultados

1. Vai à lista de jogos
2. Clica num jogo **Terminado**
3. Vês o resultado final

## 📊 Entender o Ranking

O ranking é calculado automaticamente com base em:
- **Vitórias** (mais importante)
- **Taxa de vitória** (%)
- **Pontos marcados**

**Nota**: Não é possível editar manualmente o ranking. Apenas registar resultados corretos.

## 💡 Boas Práticas

### Criação de Jogos

✅ **Fazer:**
- Criar jogos com pelo menos 2-3 dias de antecedência
- Incluir sempre o local exato
- Usar títulos descritivos ("Mix Sábado 10h" em vez de "Jogo 1")
- Confirmar disponibilidade do campo antes de criar

❌ **Evitar:**
- Criar jogos duplicados
- Eliminar jogos com jogadores já inscritos sem avisar
- Alterar horários à última hora

### Gestão de Membros

✅ **Fazer:**
- Adicionar novos membros pessoalmente
- Verificar se o perfil está completo (nome, nível)
- Ter pelo menos 2 admins ativos
- Comunicar alterações importantes

❌ **Evitar:**
- Dar permissões de admin sem necessidade
- Aceitar membros desconhecidos

### Comunicação

✅ **Fazer:**
- Usar o grupo de WhatsApp para avisos importantes
- Avisar com antecedência sobre alterações
- Responder a dúvidas dos membros
- Partilhar o link das instruções com novos membros

## 🆘 Resolver Problemas Comuns

### "Não consigo criar jogos"

- Verifica se tens permissões de admin
- Verifica se preencheste todos os campos obrigatórios
- Tenta fazer refresh à página

### "Um jogador não consegue entrar num jogo"

- Verifica se o jogo já está cheio (4/4)
- Verifica se o jogo não está fechado ou terminado
- Pede ao jogador para fazer logout/login

### "O resultado não foi guardado"

- Verifica se o jogo tem exatamente 4 jogadores
- Verifica se os resultados estão em formato número
- Tenta novamente após alguns minutos

### "A app não está a funcionar"

1. Faz refresh à página (F5)
2. Limpa a cache do browser
3. Tenta noutro browser
4. Verifica se há atualizações pendentes
5. Contacta o suporte técnico

## 🔐 Segurança

### Proteger a Conta Admin

- ✅ Usa um email/telemóvel seguro
- ✅ Não partilhes os teus dados de acesso
- ✅ Sai da app quando usares computadores partilhados
- ✅ Verifica regularmente a lista de admins

### Proteção de Dados

- A app usa encriptação para todos os dados
- Apenas admins veem contactos completos
- Não partilhes dados pessoais dos membros

## 📱 Notificações (Futuro)

Atualmente, a app **não envia notificações automáticas**. 

Para notificar os membros:
- Usa o grupo de WhatsApp
- Envia mensagem individual
- Combina um sistema de notificações futuro

### Integração Futura de Notificações

Em desenvolvimento:
- WhatsApp Cloud API (pago)
- Twilio SMS (pago)
- Telegram Bot (gratuito) ✅ Recomendado

## 📞 Contactos Úteis

### Suporte Técnico

Se precisares de ajuda técnica:
1. Consulta o README.md do projeto
2. Verifica as instruções no `/instrucoes`
3. Contacta o desenvolvedor

### Acesso ao Painel Supabase

Para gestão avançada:
- URL: [supabase.com](https://supabase.com)
- Precisa de acesso de administrador do projeto
- Permite ver/editar dados diretamente

## 🎓 Formação de Novos Admins

Quando adicionares um novo admin:

1. ✅ Partilha este guia
2. ✅ Explica as responsabilidades
3. ✅ Mostra como criar/editar jogos
4. ✅ Explica as boas práticas
5. ✅ Dá acesso ao grupo de admins

## 📝 Checklist Semanal do Admin

Todas as semanas:
- [ ] Criar jogos para a próxima semana
- [ ] Verificar se há jogos pendentes de confirmação
- [ ] Confirmar resultados não registados
- [ ] Responder a dúvidas no grupo
- [ ] Verificar se há novos membros

## 🏆 Dicas para um Grupo Ativo

1. **Regularidade**: Cria jogos fixos (ex: todos os sábados às 10h)
2. **Variedade**: Alterna horários para incluir mais pessoas
3. **Comunicação**: Mantém o grupo animado
4. **Reconhecimento**: Destaca vitórias e milestones
5. **Diversão**: O objetivo é jogar e divertir!

---

## ❓ Perguntas Frequentes

**P: Quantos admins devo ter?**
R: Recomendamos 2-3 admins ativos para garantir que há sempre alguém disponível.

**P: Posso reverter um resultado?**
R: Atualmente não. Tem cuidado ao registar resultados.

**P: Como adiciono novos membros?**
R: Partilha o link da app. Eles registam-se automaticamente.

**P: Posso personalizar o logo?**
R: Sim! Substitui os ficheiros em `public/` (consulta o README).

**P: A app funciona offline?**
R: Parcialmente. Instala como PWA para melhor experiência.

---

**Boa gestão! 🎾**

Para dúvidas adicionais, consulta o README.md ou contacta o suporte.


