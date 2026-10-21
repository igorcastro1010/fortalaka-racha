---
name: fortalaka-release
description: Finalizar tarefas do RACHA FORTALAKA com revisão, validação, autoria Git correta e entrega de commit/push no escopo autorizado. Usar antes de concluir implementação ou configuração do projeto.
---

# Finalização do Fortalaka

## Escopo e validação

1. Leia `AGENTS.md` e a solicitação atual. Trabalhe na `master` salvo orientação expressa diferente. Instruções atuais como “quero revisar”, “sem commit” ou “sem push” prevalecem sobre este fluxo padrão.
2. Revise o diff e identifique mudanças da tarefa versus alterações locais anteriores. Preserve as anteriores; não use `git add .` indiscriminadamente nem faça reset/clean para limpar o checkout.
3. Para alterações de código, executar `npm run build`, `npm run lint` e os testes existentes relevantes; corrigir erros reais e repetir os checks afetados. Atualizar Graphify conforme `AGENTS.md`.
4. Para somente documentação/skills/configuração do agente, validar os arquivos e links e usar o validador de skills disponível. Build/lint do app não são obrigatórios se nenhum código/runtime foi alterado; informar que não rodaram e por quê.
5. Executar `git status` e `git diff`; antes do commit, revisar também `git diff --cached` e os nomes staged. Excluir `.env.local`, secrets, temporários, caches, builds e `graphify-out/`. Confirmar que os arquivos necessários da tarefa e somente eles estão no commit.

## Autoria e publicação Git

- Conferir `git config --local user.name` e `git config --local user.email` antes de commitar. Valores esperados: `igorcastro1010` e `igorcastro1010@gmail.com`. Se diferentes, corrigir somente neste repositório; não alterar globais. Não forçar autor/committer “Codex” por flags ou variáveis de ambiente; conferir a identidade efetiva se houver divergência.
- Padrão solicitado para tarefas com alteração de código: após validação, criar commit curto e claro em português e executar `git push`, salvo restrição atual do usuário. Documentação/configuração só pede commit/push quando solicitado; nunca criar commit vazio nem push desnecessário.
- Mensagens úteis: “corrige entrada na lista”, “ajusta fila das partidas”, “melhora tela de avaliação”, “configura skills do projeto”. Evitar “update” genérico; usar mensagem exata quando o usuário fornecer.
- Se houver trabalho anterior misturado no mesmo arquivo, preparar o staging apenas da mudança autorizada e revisar o resultado; não incorporar mudanças alheias para facilitar o commit.
- Se o push for recusado, investigar sem descartar trabalho local. Não reescrever histórico, fazer amend de commit publicado ou usar force-push sem autorização específica.
- **Não fazer deploy**, a menos que o usuário peça explicitamente. Commit/push não autorizam executar migrações remotas, publicar manualmente na Vercel ou enviar mensagens a terceiros.

## Relatório final

- Informar o que mudou e os arquivos exatos; checks executados/resultados e limitações reais.
- Quando houver banco: SQL pendente **SIM/NÃO**, arquivo exato, dependências e RLS alterada **SIM/NÃO**; não confundir SQL no repositório com aplicação remota.
- Informar commit e hash, push **SIM/NÃO**, status final (inclusive mudanças anteriores preservadas) e deploy **SIM/NÃO**. Não declarar sucesso para etapas que falharam ou não foram executadas.
