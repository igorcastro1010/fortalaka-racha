# Fluxo pós-racha: avaliações

## Fonte de verdade e elegibilidade

O fluxo atual usa `avaliacoes` e as RPCs `alterar_avaliacoes_rodada`,
`ler_avaliacoes_atual`, `ler_progresso_avaliacoes` e `salvar_avaliacao`.
Somente organizadores ativos abrem/fecham avaliações, após finalizar o racha.
Abrir não cria notas. Fechar bloqueia novas notas e edições, preservando o histórico.

O jogador autenticado avalia como ele mesmo. A elegibilidade considera participação
em partidas finalizadas e time confirmado naquela rodada. O helper escolhe o time
com mais participações finalizadas do jogador (desempate pelo ID do time).
Não basta estar cadastrado ou inscrito: os dois jogadores precisam ter time elegível,
serem distintos e pertencerem ao mesmo time. A unicidade é por rodada, autor e avaliado.
Cada critério é inteiro de 1 a 5, obrigatório; edição atualiza o mesmo registro.

O jogador pode consultar suas próprias avaliações após o fechamento por
`VER MINHAS AVALIAÇÕES`. O formulário fica bloqueado. Não há acesso à autoria alheia;
nem o organizador recebe leitura geral das notas individuais pelas policies atuais.
Perfil e Ranking exibem agregados, sem identificar autores.

## Médias e compatibilidade

A arquitetura existente agrega historicamente as avaliações de `avaliacoes`, com
peso igual por nota recebida. O mínimo de duas respostas é **histórico por jogador**,
não por rodada. Essa regra foi preservada. Antes do mínimo, nota e radar ficam vazios.

As cinco médias originais são de 1 a 5. A nota geral pública é a média simples dos
cinco critérios multiplicada por 20, arredondada para inteiro: 4,25 resulta em 85.
`medias_jogador` retorna os critérios multiplicados por 2 para o radar de 0 a 10;
o Perfil converte esse resultado para /100. Jogos, gols, assistências e vitórias
continuam vindo das partidas finalizadas, sem edição manual no Perfil.

O Ranking ordena os agregados por overall decrescente. O progresso administrativo
conta participantes que enviaram ao menos uma avaliação, não necessariamente todos
os companheiros. O progresso pessoal conta companheiros avaliados.

`medias-perfil.sql` e `avaliacoes_jogadores` pertencem ao fluxo legado de 0 a 10.
O app atual usa `avaliacoes`, cuja API exige 1 a 5. O legado não foi apagado ou migrado
automaticamente; nenhum mock substitui os dados no fluxo atual.

## Correção incremental pendente

Aplicar manualmente no SQL Editor do Supabase, após `fluxo-sem-posicoes.sql`:

`supabase/avaliacoes-elegibilidade.sql`

O teste de um avaliado ativo sem participação expôs um retorno `NULL` no helper.
A RPC anterior verificava `NOT helper(...)`, que também resultava em `NULL`, deixando
a gravação passar. A correção exige time dos dois lados e a RPC só aceita `true`.
Não altera tabelas, policies, notas ou autores existentes; mantém os grants restritos
a usuários autenticados. As policies existentes passam a usar o helper corrigido.

**SQL PENDENTE NO SUPABASE: SIM.** Este arquivo foi validado apenas em PostgreSQL local
isolado. Não foi aplicado ao banco remoto nesta tarefa e não houve deploy.

## Validação

- `tests/avaliacoes.test.mjs`: stack SQL atual, pré-condição, escala, elegibilidade,
  autoria, privacidade, unicidade, edição, fechamento, médias e preservação histórica.
- `tests/navigation.test.mjs`: envio/edição na UI, progresso e consulta bloqueada após fechar.
- Playwright/DevTools: usar `tests/preview-sorteio.mjs --app` em loopback com PGlite;
  nenhum teste de escrita deve usar o Supabase de produção.
