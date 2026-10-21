# Contagem de participantes na aba Times

## Reprodução e causa

Em 21/10/2026, na sessão existente de Igão/organizador em produção, Home e Racha exibiram seis confirmados; Times exibiu zero, com lista aberta e sorteio desabilitado. Nenhum botão de alteração de dados foi acionado.

A divergência de fonte no frontend foi confirmada: Home/Racha usam `getCurrentRoundDetails`, que lê `rachas`, `racha_participantes` e avatares. Times usava exclusivamente `fieldPlayers` da RPC `ler_times_rodada`. Um array vazio nesse contrato era tratado como ausência real de participantes, apesar da lista conter seis. A contagem já era independente da flag de permissão de sorteio na UI; não era necessário fechar a lista para exibi-la.

O SQL antigo versionado de `ler_times_rodada` separa `tipo='linha'` de `tipo='goleiro'`. Isso é uma regra legada e não deve definir quem a tela considera participante comum. Não foi possível capturar a resposta HTTP da RPC instalada em produção com o conector da sessão existente; portanto, não se afirma que o filtro legado seja a causa comprovada do array vazio remoto, nem que alguma migração esteja aplicada. Erros de RLS, joins e payload remoto não foram presumidos a partir do grafo.

## Consulta anterior e regra nova

Antes:

```ts
supabase.rpc("ler_times_rodada", {})
// fieldPlayers da RPC era toda a fonte da contagem e do sorteio.
```

Agora, o repositório de Times reutiliza `getCurrentRoundDetails`:

```text
rachas: order data desc nulls last, created_at desc, id desc; limit 1
racha_participantes: select id,jogador_id,nome,tipo,status
                     where racha_id = rodada atual; order created_at asc
avatars_da_rodada(p_racha): fotos da mesma rodada
```

Aptos: `status='confirmado'` e `tipo!='suplente'`, incluindo participantes com o antigo tipo `goleiro`, sem posição especial. Ausentes/removidos e a lista separada de suplentes não entram no sorteio. Não há filtro de participantes condicionado a `aberto`/`lista_fechada` e não se inventa contagem local.

A RPC continua fornecendo times persistidos, versão e confirmação; não há mudança de escrita ou de permissão. O repositório recusa respostas de outra rodada/estado em vez de misturar leituras concorrentes. Erros de consulta são propagados, sem converter falhas em zero. Não foram alterados SQL, RLS ou os controles que exigem lista fechada para sortear.

## Validação

- Produção, antes da correção: **6 / 6 / 0**, lista aberta, console sem erros capturados. Somente leitura/navegação; sem dados reais alterados.
- Local isolado: componentes e repositórios reais, PostgreSQL/PGlite com seis participantes sintéticos. A resposta de `ler_times_rodada` foi propositalmente reduzida a `fieldPlayers: []` para reproduzir a divergência de contrato; não é uma captura da resposta remota.
- Playwright local: **Home 6 / Racha 6 / Times 6**; recarga manteve seis em Times, lista aberta e sorteio bloqueado. Não sortear, fechar lista ou criar partidas para testar esta correção.
- Chrome DevTools local: quatro leituras de Times inspecionadas, todas HTTP 200: rodada aberta, seis participantes filtrados por `racha_id`, avatares e RPC com array vazio. Nenhum 4xx/5xx, erro de RLS ou exceção JS nessas leituras. O adaptador local usa POST `/api` para executar consultas; não são requisições PostgREST de produção.
- `tests/times-participantes.test.mjs`: seis confirmados com RPC vazia, estados aberto/fechado/confirmado/finalizado, tipo legado, fotos, exclusão de ausente/suplente, preservação de times/versão, erros explícitos e rodada divergente. **OK**.
- `tests/navigation.test.mjs`: fluxo de navegação existente completo após a mudança do repositório. **OK**.
- `npm run build`: **OK**. `npm run lint`: **OK**. Graphify atualizado localmente.

## Arquivos e entrega

- `src/lib/teams/repository.ts`: somente o incremento de leitura consistente de participantes.
- `tests/times-participantes.test.mjs`: regressão nova, sem cliente ou credenciais remotos.
- `docs/correcao-participantes-times.md`: evidências e limites.

Mudanças anteriores misturadas no repositório permanecem locais e não são incluídas automaticamente no commit. SQL novo pendente: **NÃO**. RLS alterada: **NÃO**. A migração anterior `fluxo-sem-posicoes.sql` continua um trabalho separado, sem confirmação de aplicação nesta tarefa.

**Sem deploy:** a produção continua servindo a versão anterior e pode permanecer em 6/6/0 até uma publicação explicitamente autorizada. O resultado 6/6/6 refere-se ao código corrigido validado localmente. Inspeção HTTP autenticada do Supabase remoto continua pendente; não declarar ausência de erros de rede remotos sem essa captura.
