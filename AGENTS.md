<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Skills do RACHA FORTALAKA

Consulte Graphify primeiro, conforme as regras acima. A skill instalada esta em `.codex/skills/graphify/SKILL.md`.
Use as skills locais conforme a tarefa, combinando-as quando necessario:
- Backend, Supabase e regras de negocio: `.agents/skills/fortalaka-backend/SKILL.md`.
- Frontend, design e UX: `.agents/skills/fortalaka-ui/SKILL.md`.
- Antes de finalizar tarefas: `.agents/skills/fortalaka-release/SKILL.md`.

## Diagnóstico de bugs

Fluxo: bug reportado → Graphify query → Playwright MCP reproduz → Chrome DevTools MCP inspeciona console/network/performance → identificar causa → abrir somente os arquivos necessários e corrigir → Playwright testa novamente → build/lint e testes pertinentes → commit → push, respeitando o pedido atual e `fortalaka-release`.

- MCPs locais: `playwright` e `chrome-devtools`; configuração no Codex deste PC, sem credenciais no Git. Reinicie a sessão do Codex se os novos servidores ainda não aparecerem como ferramentas.
- Prefira localhost quando disponível. Em produção, faça apenas navegação segura; sem login autorizado, limite o teste às páginas públicas. Não altere rodadas reais nem cadastre dados falsos para diagnóstico.
- Use perfis isolados; mantenha sessões, cookies, traces e saídas do navegador fora do repositório. Graphify permanece local e ignorado; a integração existente está em `.codex/skills/graphify/`.
