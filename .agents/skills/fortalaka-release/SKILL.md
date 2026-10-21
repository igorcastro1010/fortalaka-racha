---
name: fortalaka-release
description: Revisar e finalizar tarefas do RACHA FORTALAKA com validacoes pertinentes, autoria Git correta, commit e push conforme o escopo autorizado, sem deploy implicito.
---

# Finalizacao do RACHA FORTALAKA

## Tarefas com alteracao de codigo

1. Revise as mudancas e o escopo; preserve alteracoes preexistentes do usuario.
2. Execute npm run build e npm run lint. Corrija erros reais introduzidos pela tarefa e execute testes relevantes existentes. Relate falhas preexistentes sem ampliar o escopo silenciosamente.
3. Atualize o grafo com graphify update . conforme AGENTS.md e verifique os resultados. Nao versione graphify-out/ quando ignorado.
4. Execute git status e git diff; revise tambem git diff --cached antes do commit. Confira que .env.local, secrets, temporarios e graphify-out/ nao serao incluidos indevidamente.
5. Confira git config --local user.name e git config --local user.email. Valores esperados: igorcastro1010 e igorcastro1010@gmail.com. Se divergirem, corrija apenas neste repositorio; nao altere a configuracao global sem necessidade.
6. Adicione apenas os arquivos da tarefa, crie commit curto e claro em portugues e execute git push quando isso estiver autorizado pelo pedido vigente. Respeite pedidos explicitos de nao commitar/nao fazer push; nao use force-push para contornar divergencias.
7. Confirme git status final e o resultado do push. Nao faca deploy, a menos que o usuario solicite explicitamente.

## Tarefas sem alteracao de codigo

- Nao crie commit vazio nem execute push desnecessario.
- Para documentacao/skills/configuracao do agente, valide estrutura, frontmatter, referencias e diff; build/lint do app nao sao necessarios se seu comportamento nao mudou. Explique a dispensa.
- Se houver arquivos versionaveis alterados e o pedido autorizar commit/push, siga a revisao, autoria e publicacao acima. Uma tarefa somente de consulta nao exige commit.

## Entrega

Use mensagem que descreva a mudanca, sem update generico: corrige entrada na lista, ajusta fila das partidas, melhora tela de avaliacao ou configura skills do projeto.

Informe resultado, validacoes executadas ou dispensadas com motivo, limitacoes relevantes, commit/hash, push e status final. Nunca declare teste, SQL aplicado ou deploy que nao executou.
