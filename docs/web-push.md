# Notificacoes no celular

## Estado e limites

O sino continua funcionando sem push. O push e opcional por aparelho e depende
da configuracao abaixo. Nao basta aplicar o SQL ou publicar somente o Next.js.
Nao ha envio de historico ao ativar: somente avisos criados depois da adesao.
O texto na tela bloqueada e generico, sem nomes, valores ou dados PIX.

Eventos: avisos ja existentes de rodada, times, avaliacoes e conquistas; mais
confirmacao de pagamento pelo organizador. Escolher PIX/Dinheiro nao confirma
pagamento nem gera aviso financeiro. Nao ha lembrete agendado antes do jogo.

No iPhone/iPad, requer iOS/iPadOS 16.4+ e app adicionado a Tela de Inicio.
Abrir o app instalado, ir ao sino e tocar em ativar. A permissao nunca e pedida
automaticamente. Android/desktop precisam de navegador compativel e HTTPS.
O sistema operacional, modo Foco e rede podem atrasar ou impedir a entrega.

## Ativacao em producao (pendente; requer autorizacao)

1. Aplicar `supabase/web-push.sql` depois de `notificacoes.sql` e `pagamentos.sql`.
   E incremental/idempotente e nao remove dados antigos. Acrescenta RLS, RPCs,
   assinaturas por usuario e fila. Nao preencher a fila com avisos antigos.
2. Gerar um unico par VAPID em ambiente privado com `web-push@4.0.0`
   (`generateVAPIDKeys()`, export nomeado). Guardar a chave privada fora do Git.
   Gerar tambem `PUSH_DISPATCH_SECRET`, aleatorio, com pelo menos 32 bytes.
3. Nos secrets da Edge Function cadastrar:
   - `WEB_PUSH_PUBLIC_KEY`: chave publica VAPID.
   - `WEB_PUSH_PRIVATE_KEY`: chave privada VAPID (nunca NEXT_PUBLIC).
   - `WEB_PUSH_SUBJECT`: contato real `mailto:` ou URL HTTPS publica.
   - `PUSH_DISPATCH_SECRET`: segredo exclusivo do dispatcher, nao a service key.
   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sao fornecidos pelo Supabase.
4. Publicar `supabase/functions/send-push` com `supabase functions deploy send-push`.
   `supabase/config.toml` desliga JWT apenas nesta funcao: ela exige POST e
   `x-push-secret` valido antes de consultar o banco. Nao habilitar acesso aberto.
5. Criar no Vault os secrets `fortalaka_push_project_url` (URL HTTPS do projeto)
   e `fortalaka_push_dispatch_secret` (mesmo segredo exclusivo da funcao).
   Usar o painel privado; nao copiar chaves para SQL versionado ou mensagens.
6. Aplicar `supabase/push-agendamento.sql`. Usa pg_cron/pg_net a cada minuto,
   somente quando ha itens pendentes. Nao enviar a service-role key pelo cron.
   O segredo de disparo passa temporariamente pela fila pg_net, que deve ser
   restrita a administradores, assim como o Vault.
7. Na Vercel, definir `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` com a mesma chave publica
   e publicar o app. Chave publica nao e segredo; nao trocar o par sem planejar
   recadastro das assinaturas existentes.
8. Em um aparelho real e conta autorizada, ativar, fechar o app e produzir um
   evento legitimo. Confirmar entrega, destino ao tocar, revogacao e logout.
   Nunca cadastrar rodadas/contas ficticias em producao para testar.

## Operacao

O dispatcher processa lotes de 10, com timeout por provedor, lease e fencing.
404/410 removem a assinatura expirada; falhas temporarias tentam novamente com
limite. Falhas permanentes nao insistem. Entrega e pelo menos uma vez: uma falha
de confirmacao apos aceitar no provedor pode repetir o aviso; tag estavel evita
duplicacao visual. Nao existe garantia de entrega em aparelho desligado.
Nunca registrar endpoints, chaves, payloads individuais ou erros crus do provedor.

Para suspender envios, desativar o job `fortalaka-enviar-push` no Supabase Cron.
O sino permanece funcionando. Revogar/trocar apenas o segredo de disparo nao
exige recadastrar aparelhos; trocar VAPID exige planejamento.

## Verificacao local

`node tests/push-dispatch.test.mjs` e `node tests/push-worker.test.mjs` usam Node.
Para SQL/client/browser, manter dependencias de teste fora do app, como no fluxo
existente: `node tests/push-sql.test.mjs <node_modules-de-testes>`,
`node tests/push-client.test.mjs <node_modules-de-testes>` e
`node tests/push-browser.test.mjs <node_modules-de-testes>`.
Dependencias: PGlite, esbuild e Playwright; browser tambem usa CSS de `npm run build`.
O browser usa fixtures isoladas, captura console por CDP e salva screenshots no
diretorio temporario, nunca no Git. Testar tambem os scripts PWA existentes.
Checar o runtime separado: `npx deno@2.2.15 check --config supabase/functions/send-push/deno.json supabase/functions/send-push/index.ts`.
Validar imports e autenticacao reais: `npx deno@2.2.15 run --config supabase/functions/send-push/deno.json --allow-env tests/push-edge.test.mjs`.
Usar Deno 2.2.15 nestes checks preserva o lockfile v4 compativel com o Edge Runtime.
O runtime Edge usa dependencias npm fixadas e nao entra no bundle Next.js.
Build/lint nao substituem teste real em iPhone/Android nem aplicacao remota.

### Validacao desta implementacao

Build e lint passaram; testes de dispatcher, criptografia/runtime Deno, RPC/RLS,
worker, cliente e browser passaram. Regressao: notificacoes, pagamentos (SQL/UI),
autenticacao, navegacao completa e PWA offline/atualizacao. O teste de navegacao
foi alinhado ao pagamento obrigatorio que ja existia, sem mudar regras do app.
Browser isolado: 360/375/390/430 px, sem overflow e sem erros no console CDP.
Revisao Apple Design: consentimento por gesto, revogacao na mesma tela, texto
legivel, feedback de estado e controles >=44px, sem depender apenas de cor.
Revisao React: efeitos com cleanup, mutacoes por gesto, exclusao concorrente e
backend fora do bundle cliente. Graphify atualizado localmente.

Nao foram executados envios reais, teste fisico de iPhone/Android, concorrencia
SQL em conexoes independentes ou aplicacao remota. PGlite valida transacoes,
leases e fencing sequencialmente; nao substitui um teste de carga Postgres.

Referencias oficiais:
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://supabase.com/docs/guides/functions/schedule-functions
- https://github.com/web-push-libs/web-push
