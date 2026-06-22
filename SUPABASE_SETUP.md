# Configuracao do Supabase

O Supabase Auth armazena as contas no schema protegido `auth`. Para tambem
visualizar os usuarios no Table Editor, o projeto usa a tabela
`public.profiles`. As tarefas ficam em `public.tasks`.

## Criar as tabelas

1. Abra o projeto no Supabase Dashboard.
2. Acesse **SQL Editor**.
3. Clique em **New query**.
4. Cole todo o conteudo de
   `supabase/migrations/202606140001_create_profiles.sql`.
5. Clique em **Run**.
6. Crie outra query.
7. Cole todo o conteudo de
   `supabase/migrations/202606150001_create_tasks.sql`.
8. Clique em **Run**.

O script de perfis:

- cria `public.profiles`;
- ativa Row Level Security;
- permite que cada usuario acesse somente o proprio perfil;
- cria automaticamente um perfil para cada novo cadastro;
- adiciona a tabela os usuarios que ja existem em **Authentication > Users**.

O script de tarefas:

- cria `public.tasks`;
- ativa Row Level Security;
- permite que cada usuario liste, crie, edite e exclua somente as proprias
  tarefas;
- usa os campos pedidos no trabalho:
  `id`, `user_id`, `titulo`, `descricao`, `prioridade`, `concluida`,
  `latitude`, `longitude`, `nome_local` e `created_at`.

Depois de executar, abra **Table Editor > profiles** para conferir os perfis e
**Table Editor > tasks** para conferir as tarefas criadas pelo app.

As senhas nunca sao copiadas para essas tabelas. Elas permanecem protegidas pelo
Supabase Auth.
