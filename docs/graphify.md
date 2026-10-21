# Graphify no RACHA FORTALAKA

Versão validada neste PC: **graphifyy 0.9.93**, com extra SQL. O comando é `graphify`; o pacote oficial é **graphifyy** (dois y). A integração do Codex está em `.codex/skills/graphify/`, `.codex/hooks.json` e `AGENTS.md`. Não há dependência de runtime no app.

## Instalar e atualizar nos dois PCs

Instalação básica: `uv tool install graphifyy`. Para este projeto, que contém SQL, use:

```powershell
uv tool install "graphifyy[sql]"
uv tool update-shell
graphify --version
uv tool list
```

Abra outro terminal se o PATH ainda não reconhecer os executáveis. Atualize com:

```powershell
uv tool upgrade graphifyy
```

Se o uv informar que uma versão antiga está fixada, substitua a instalação fixada por:

```powershell
uv tool install "graphifyy[sql]@latest"
```

Depois confira a versão antes de atualizar a integração. Nesta revisão, 0.9.92 passou para 0.9.93; a skill reinstalada coincide com a versão 0.9.93 já versionada. Para versões posteriores, revisar os diffs, sem sobrescrever regras específicas do projeto.

```powershell
graphify install --project --platform codex
```

O instalador pode substituir a seção Graphify do `AGENTS.md`; preserve/mescle as regras locais, o bloco Next.js, as skills Fortalaka e o fluxo de diagnóstico. Revise também cópias `.bak`, que não devem entrar no Git. Reinicie a sessão do Codex quando necessário para recarregar a skill. O hook `graphify hook-check` desta integração é um no-op; as orientações ficam no `AGENTS.md`.

## Gerar, atualizar e consultar

Na **CLI 0.9.93**, a geração inicial usa `extract`. `graphify .` não é um subcomando de geração desta versão; **`/graphify .`** é a invocação da skill dentro do Codex. Para gerar localmente sem backend externo:

```powershell
graphify extract . --code-only
graphify cluster-only . --no-label
```

Após alterações ou `git pull`, com o grafo já existente:

```powershell
graphify update .
graphify query "onde está a lógica da lista do racha?" --budget 1000
graphify query "onde está o sorteio de times?" --seed drawTeams --budget 1000
graphify query "onde estão as avaliações?" --seed EvaluationArea --budget 1000
graphify explain "drawTeams"
graphify path "TeamsScreen" "drawTeams"
```

Consultas em português podem priorizar testes; use `--seed` com um símbolo retornado para focar a busca. O grafo local não comprova SQL aplicado nem comportamento em produção.

## Abrir o visual no Windows

O visual fica em `graphify-out/graph.html`. No PowerShell, a partir da raiz do projeto:

```powershell
cmd.exe /d /c 'start "" "graphify-out\graph.html"'
```

Se o terminal estiver em outra pasta, use o caminho absoluto entre aspas.

## Cuidados e validação

- Uma única entrada `graphify-out/` no `.gitignore`; cada PC gera seu próprio grafo. Não versionar HTML, JSON, relatórios gerados ou caches.
- Respeitar `.gitignore`: não indexar `.env.local`, credenciais, `.next`, `.vercel` ou `node_modules`; não usar `--no-gitignore`.
- `--code-only`, `--no-label` e a atualização rotineira mantêm a extração local; não configurar backends semânticos externos como parte deste fluxo.
- Nesta padronização: integração reinstalada, instruções específicas preservadas, grafo atualizado e três consultas de lista/sorteio/avaliações validadas. Nenhum código do app, SQL de negócio, dependência npm ou configuração Vercel foi alterado.

Fontes: [pacote oficial](https://pypi.org/project/graphifyy/) e [repositório oficial](https://github.com/Graphify-Labs/graphify). Os comandos acima foram conferidos na ajuda da CLI instalada.
