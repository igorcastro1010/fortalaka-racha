# Auditoria funcional — 21/10/2026

## Escopo e limites

Auditoria na `master`, com Graphify 0.9.92, Playwright MCP e Chrome DevTools MCP funcionais. Sem deploy, escrita no Supabase remoto, credenciais inventadas ou dados falsos em produção.

O Next.js foi testado em `localhost:3000`, inclusive após `npm run build` com `npm run start`. Para os fluxos autenticados, foi usado o ambiente existente `tests/preview-sorteio.mjs --app`, em `127.0.0.1:3011`: componentes reais, repositórios reais e SQL real em PostgreSQL/PGlite isolado; o cliente Supabase/Auth é substituído por um adaptador de teste. Isso valida UI e regras locais, mas **não comprova login real no provedor, PostgREST, cookies de sessão ou policies instaladas no Supabase remoto**. Não havia contas seguras e banco remoto de teste fornecidos para essa validação.

Alterações anteriores de app, SQL, testes e Graphify foram preservadas. O commit desta auditoria contém somente os incrementos abaixo, sem incorporar o trabalho anterior misturado nos mesmos arquivos. Portanto, o resultado do checkout completo inclui mudanças locais anteriores ainda não publicadas.

## Evidências por fluxo

| Fluxo | Validação e resultado |
| --- | --- |
| Login/cadastro/recuperação | Playwright nas páginas locais; rota `/` anônima redireciona para `/login`. Sem envio de credenciais, cadastro ou e-mail remoto. Login real e recuperação com token permanecem pendentes. |
| Home e navegação | Cinco abas acessíveis como jogador/organizador no ambiente isolado; resumo da rodada e inscrição carregam. |
| Entrar/sair da lista | Entrada direta, sem posição. Saída, cancelamento da saída e reentrada conferidos no navegador e teste de navegação; lista fechada bloqueada por SQL/RLS isolado. |
| Gestão da rodada | Criar próxima rodada, fechar/reabrir e roles cobertos por navegação automatizada; inserção/remoção e proteção de terceiros cobertas por SQL/RLS. Não executar essas ações em produção. |
| Sorteio | 10, 13, 15, 18, 20 e outras quantidades nos testes TypeScript/SQL; máximo de cinco por novo time e tamanhos equilibrados. Navegador: rascunho, troca de aba, recarga e confirmação. Ajustes e identidade dos times cobertos por SQL. |
| Partidas e fila | Navegador: iniciar, placar manual, dois gols sugerem finalizar, CONTINUAR mantém partida aberta, confirmação de finalização. SQL: vencedor permanece, empate retira os dois, filas variáveis, correções e persistência. |
| Gols/assistências/participação | Navegador: gol de Conta teste e assistência de Pessoa 11, com placar 2×0 e um único autor identificado. SQL: correção/remoção de eventos, participação e ausência de duplicação por JOIN. |
| Encerrar racha | Navegador: confirmação, status finalizado e abertura separada de avaliações. SQL: `finalizada_at`, preservação de lista/times/fila/eventos e bloqueio de novas partidas/sorteios. Histórico continuou visível ao jogador. |
| Avaliações | Navegador: quatro companheiros, sem próprio jogador/adversários; envio e edição mantêm “1 de 4”; organizador fecha e jogador perde a entrada para avaliar. SQL: limites 1–5, unicidade, identidade, privacidade, bloqueio após fechamento e médias preservadas. |
| Perfil e ranking | Navegador: jogo/gol/vitória do jogador e assistência do companheiro refletem a partida finalizada. Overall/radar exigem duas respostas; SQL confirma médias e overall; ordenação decrescente revisada no componente. |
| Mobile | 375×812 e 390×844, páginas públicas e cinco abas: sem overflow horizontal. Repetição após corrigir o DOCTYPE confirmou `CSS1Compat`. Botões principais e navegação permaneceram acessíveis. |
| Segurança | Testes SQL isolados de RLS/roles, inscrição própria, composição, eventos, avaliações e Storage; rota protegida anônima verificada no Next.js. Nenhuma nova policy ou mudança de permissão nesta auditoria. |

## Bugs corrigidos

1. **Saída sem confirmação:** Playwright reproduziu remoção com zero diálogos. Agora cancelar “Sair da lista desta rodada?” preserva a inscrição; confirmar executa a saída. Entrada continua sendo de um toque. Regressão incluída no teste de navegação.
2. **Foto ausente no perfil inicial do shell:** a consulta `getCurrentUserProfile` omitia `avatar_url`, embora o cabeçalho use essa propriedade. A projeção passou a incluí-la. Teste isolado verifica retorno da foto, filtro pelo usuário autenticado e ausência de consulta como anônimo. Não foi feito upload remoto.
3. **Autofill de autenticação incompleto:** inputs sem `name`/`autocomplete`, com aviso no Chrome. Login usa `username/current-password`, cadastro e recuperação usam os tokens adequados para nome/e-mail/nova senha. Conferido no DOM real.
4. **Toque em recuperar senha:** área tinha 20 px; passou a pelo menos 44 px, conferidos no navegador do build local.
5. **Preview em Quirks Mode:** HTML do ambiente isolado não tinha DOCTYPE. Corrigido apenas o harness; repetição confirmou modo padrão e ausência do aviso de Quirks Mode.

A revisão `react-best-practices` foi aplicada aos incrementos TSX: validação antes de iniciar mutação, componentes controlados, labels preservados, sem hooks condicionais, novas dependências ou refatoração ampla.

## Console e rede

- Aviso de autocomplete reproduzido no login e ausente depois da correção. Nenhuma exceção JavaScript ou promise rejeitada observada nos fluxos concluídos.
- `missing.png` retorna 404 propositalmente no preview existente. O fallback de iniciais funciona; não é falha do Supabase nem do app em produção.
- Quirks Mode existia apenas no preview; corrigido e retestado.
- No build local, Chrome registrou aviso de imagem pré-carregada de 96 px não utilizada. O caminho corresponde ao escudo do estado de loading, que sai quando o login é renderizado. É um aviso de preload transitório; a imagem respondeu normalmente. Não foi feita alteração funcional por esse aviso.
- Navegação pública e requests locais de dados responderam com sucesso nos testes concluídos; não foram observados 5xx, CORS ou falhas de RLS nesse ambiente. Requests de leitura repetidos foram compatíveis com montagem/troca de abas, sem evidência de loop contínuo. Isso não mede tráfego autenticado remoto.

## Validação executada

- `npm run build`: **OK**; TypeScript e geração de rotas concluídos.
- `npm run lint`: **OK**.
- `node --experimental-strip-types --test tests/sorteio.test.mjs tests/perfil-medias.test.mjs`: **13 testes OK**. Node emite aviso de módulo TypeScript sem `type: module`; não é falha de teste.
- Scripts SQL isolados **OK**: `sorteio-sql`, `perfil-medias-sql`, `partidas-estatisticas`, `avaliacoes`, `finalizar-rodada`, `fluxo-principal`, `fluxo-sem-posicoes`.
- `tests/navigation.test.mjs`: **OK**, repetido após confirmação de saída e DOCTYPE.
- Novo `tests/auth-profile.test.mjs`: **OK**.
- Dependências externas dos testes: `%TEMP%/fortalaka-round-tests`; nenhuma adicionada ao package.json do app. Uso: `node tests/<nome>.test.mjs "$env:TEMP/fortalaka-round-tests"`.
- Graphify atualizado localmente; `graphify-out/` continua ignorado.

## SQL, arquivos e pendências

**SQL novo nesta auditoria: NÃO. RLS alterada nesta auditoria: NÃO.**

**SQL anterior pendente: SIM, sem confirmação de aplicação:** `supabase/fluxo-sem-posicoes.sql`, já presente entre as alterações locais ao iniciar a auditoria. Os testes completos sem posições aplicam esse arquivo após `supabase/fluxo-principal.sql`. Nenhum desses testes prova que a migração está aplicada no ambiente remoto. Esse SQL e o trabalho anterior não são incluídos automaticamente no commit desta auditoria.

Arquivos com incrementos desta auditoria:

- `src/components/rounds/OwnRegistration.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/SignupForm.tsx`
- `src/components/auth/ResetPasswordForm.tsx`
- `src/lib/auth/get-profile.ts`
- `tests/navigation.test.mjs`
- `tests/preview-sorteio.mjs`
- `tests/auth-profile.test.mjs` (novo)
- `docs/auditoria-funcional-2026-10-21.md` (novo)

Pendências: login/sessão reais e fluxos completos contra Supabase de teste com contas seguras; confirmação da migração anterior; revisão/publicação das alterações anteriores preservadas; aviso informativo de preload. Nenhum deploy autorizado ou executado.
