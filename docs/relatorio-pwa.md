# Entrega PWA — 30/10/2026

## Checklist solicitado

| Item | Resultado e evidência |
| --- | --- |
| 1. PWA implementada | SIM: manifest nativo, ícones, worker, atualização, instalação e offline limitado. |
| 2. find-skills usado | SIM, buscas documentadas em `pwa.md`. |
| 3. Skills encontradas | nextjs-pwa, pwa-service-worker, pwa-development, progressive-web-app, apple-web-app. |
| 4. Skills instaladas | Nenhuma nova; skills locais e guias do Next instalado suficientes. |
| 5. Manifest | OK: Next real e CDP, sem erros de parsing. |
| 6. Service worker | OK: registro em produção, scope `/`, oito recursos públicos no cache. |
| 7. Ícone 192 | OK: PNG 192×192, gerado do escudo oficial. |
| 8. Ícone 512 | OK: PNG 512×512, sem ampliar a fonte de 640×640. |
| 9. Maskable | OK: 192/512, escudo inteiro dentro da área segura circular. |
| 10. Apple touch icon | OK: PNG 180×180 e metadata. |
| 11. Standalone | OK de configuração/CDP e ocultação de CTA simulada; abertura pelo SO não testada fisicamente. |
| 12. Safe area | OK: viewport-fit cover, avisos e app respeitam insets; sem sobreposição fixa adicionada. Insets físicos de aparelho não medidos. |
| 13. Offline state | OK: aviso no app aberto, sem envio automático. |
| 14. Offline fallback | OK: documento público, botão de nova tentativa, nenhum HTML privado. |
| 15. Conexão restaurada | OK: evento e conexão restabelecida durante carregamento do fallback. |
| 16. Update flow | OK: aceite explícito, falha recuperável, publicações sucessivas, duas abas e rascunho preservado na outra aba. |
| 17. Install CTA | OK: evento nativo simulado, recusa persistente, instrução iOS e ocultação quando instalado. |
| 18. Android | Compatibilidade de manifest/ícones/standalone OK; instalação física NÃO TESTADA. |
| 19. iOS | Metadata, ícone, orientação contextual e safe areas OK em compatibilidade/emulação; Safari físico NÃO TESTADO. |
| 20. Desktop install | Manifest aceito pelo Chromium; sessão MCP isolada informa `in-incognito`, portanto instalação no SO NÃO TESTADA. |
| 21. Supabase auth preservado | SIM no código: não alterada lógica de sessão/cookies/login/logout; redirects reais sem sessão e testes locais passaram. Login real autorizado não executado. |
| 22. Dados privados não cacheados | SIM nos testes de worker/Chromium/Next: somente oito assets enumerados; HTML/API/RSC/Supabase/Authorization excluídos. Logout fictício seguido de offline não revelou dados privados. |
| 23. Banco alterado | NÃO. SQL pendente: NÃO. |
| 24. RLS alterado | NÃO. |
| 25. Mobile 360×800 | OK: sem overflow no Next/fallback e verificação visual existente. |
| 26. Mobile 375×812 | OK, mesmas verificações. |
| 27. Mobile 390×844 | OK, mesmas verificações. |
| 28. Mobile 430×932 | OK, mesmas verificações. Desktop 1280×900 também. |
| 29. Playwright | OK: MCP e teste Chromium; sete suites relevantes descritas abaixo. |
| 30. DevTools | OK: MCP confirmou manifest, scope, oito entradas públicas, ausência de HTML privado e console online sem erros/warnings. |
| 31. Lighthouse | Login real local: acessibilidade 100, boas práticas 100, SEO 92. Sem categoria PWA no auditor atual; CDP fez auditoria equivalente de manifest/installability. |
| 32. Build | OK: `npm run build`, Next 16.3.8, dez rotas/páginas geradas. |
| 33. Lint | OK: `npm run lint`. |
| 34. Testes | OK: icons, worker, browser, production, auth-profile, navigation e visual-remodel. |
| 35. Arquivos | Relação completa abaixo. |
| 36. Commit | Commits pequenos na master; inclui mensagem solicitada `adiciona suporte PWA ao Fortalaka`. |
| 37. Hashes | Código revisado em `96ab1a6`; lista abaixo. SHA final publicado obtido por `git rev-parse HEAD`. |
| 38. Push | OK: commits publicados em origin/master. |
| 39. Git status | Só alterações anteriores preservadas em package.json/package-lock.json e skills locais; não incorporadas à entrega. |
| 40. Deploy | Autorizado pelo pedido direto mais recente; aguardando execução após este relatório. Registro de resultado será acrescentado. |

## Evidências e limites

- `node tests/pwa-icons.test.mjs`: dimensões, opacidade, escudo, safe circle e ICO com PNG RGBA.
- `node tests/pwa-worker.test.mjs`: cache enumerado e sem credenciais, exclusões de auth/API/RSC/Supabase, ativação e fallback de rede.
- `node tests/pwa-browser.test.mjs <deps>`: Chromium real com servidor fictício isolado; instalação/recusa, iOS contextual, standalone, updates, duas abas, offline e logout sem cache privado. User-agent/eventos simulados não demonstram instalação física.
- `node tests/pwa-production.test.mjs http://localhost:3021`: Next real, respostas públicas/headers, metadata única e redirects de `/`, `/comparar`, `/notificacoes` para login.
- `auth-profile.test.mjs` e `navigation.test.mjs`: perfil, cinco abas, separação dos processos, roles, avaliações e ações sem duplicação com banco local fictício.
- `visual-remodel.test.mjs <deps> http://localhost:3021`: 156 capturas, cinco viewports, duas roles, teclado, targets, imagens, overflow e network. Saída local: `%TEMP%/fortalaka-remodel-ziW70P`.
- Playwright MCP no Next real: carregamento de `/comparar` offline mostrou fallback público; reconectar e tentar novamente voltou ao login. Cache permaneceu só com assets públicos.
- DevTools Lighthouse no login Next: relatórios locais `%TEMP%/chrome-devtools-mcp-ZO2soI/report.json` e `%TEMP%/chrome-devtools-mcp-UXlP30/report.html`. SEO: robots.txt ausente/inválido; auditoria adicional de agentes reclama llms.txt/ai-catalog. Itens fora do escopo PWA, sem alteração de auth para permitir crawlers.
- Falha de favicon RGB encontrada no primeiro build foi corrigida em commit próprio. Teste de conectividade revelou volta da conexão antes do listener; fallback agora verifica o estado inicial. A revisão independente identificou e corrigiu o risco de botão preso em atualização de worker obsoleto.
- Worker: 3.034 bytes; cinco ícones PNG somam 476.177 bytes. Sem biblioteca PWA ou dependência de produção adicionada. Requests dinâmicos continuam na rede. Nenhum teste modificou dados remotos.
- Graphify atualizado localmente (2.444 nós/4.072 relações); arquivos gerados continuam ignorados. Revisão React: efeitos com cleanup, preferência local versionada, registro pós-load, verificação de update limitada por tempo e nenhum fetch adicional de dados do racha.

## Arquivos da entrega

```text
docs/pwa.md
docs/pwa-operacao.md
docs/relatorio-pwa.md
next.config.ts
public/offline.html
public/pwa/apple-touch-icon.png
public/pwa/icon-192.png
public/pwa/icon-512.png
public/pwa/maskable-192.png
public/pwa/maskable-512.png
public/pwa/offline.js
public/sw.js
scripts/generate-pwa-icons.mjs
src/app/favicon.ico
src/app/layout.tsx
src/app/manifest.ts
src/components/pwa/ConnectivityStatus.tsx
src/components/pwa/InstallPrompt.tsx
src/components/pwa/PwaExperience.tsx
src/components/pwa/usePwaRegistration.ts
src/proxy.ts
tests/pwa-browser.test.mjs
tests/pwa-icons.test.mjs
tests/pwa-production.test.mjs
tests/pwa-worker.test.mjs
```

## Histórico da implementação

```text
3939702 documenta arquitetura e segurança da PWA
d28508b gera ícones PWA e favicon com o escudo oficial
a2166ca corrige favicon RGBA para o decoder do Next.js
b318f85 configura manifest nativo e metadata de instalação
ad494e1 prepara fallback offline e acesso público dos recursos PWA
4a38971 protege dados privados com cache restrito no service worker
fd2b255 corrige retorno da conexão durante carregamento offline
ecb7f88 adiciona suporte PWA ao Fortalaka
bfaeff4 oferece instalação discreta com suporte ao Safari
df6d997 testa PWA no Chromium com sessão e rede isoladas
22b3453 respeita notch no convite de instalação
c53e53d recupera atualização após troca de worker ou falha
629c608 valida atualizações sucessivas e nova tentativa
e66f10e verifica recursos PWA e proteção de rotas no Next
3dc64e7 documenta instalação e manutenção da PWA
96ab1a6 preserva rascunhos em outra aba durante atualização
```
