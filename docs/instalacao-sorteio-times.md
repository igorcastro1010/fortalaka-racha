# Sorteio de times — instalação e teste

## Instalar no Supabase

1. O projeto deve ter `supabase/schema.sql` instalado (estrutura de usuários e permissões já usada pelo login).
2. No SQL Editor do projeto Supabase correspondente ao `.env.local`, execute todo o arquivo `supabase/sorteio-times.sql`.
3. O script roda em uma transação e pode ser executado novamente. Não insere participantes nem usuários de teste e não modifica o cadastro de usuários.
4. Selecione **Times** no aplicativo. Antes de instalar o SQL, a tela exibe uma mensagem explicando que a estrutura ainda não está disponível.

Esta entrega prepara o SQL; não o aplica automaticamente ao banco remoto e não faz deploy.

## Uso

Entre com uma conta ativa de organizador. Na aba **Times**, crie uma rodada com nome e data. Em **EDITAR PARTICIPANTES**, adicione nomes, um por linha, escolhendo a categoria de cada grupo: os dois goleiros fixos, os 20 jogadores de linha e eventuais suplentes. Marque ausentes e removidos no campo de presença. Salve a lista.

A seção **GOLEIROS FIXOS** fica acima dos times. A disponibilidade considera somente `tipo = linha` e `status = presente`. O sorteio oficial exige exatamente 20 participantes elegíveis e gera quatro times de cinco.

O rascunho do sorteio permanece somente na tela do organizador até **CONFIRMAR TIMES**; sair da aba ou recarregar o navegador descarta esse rascunho. Para trocar jogadores, escolha **AJUSTAR TIMES**, selecione um jogador e depois outro de um time diferente. Uma troca mantém os dois times com cinco pessoas.

Ao confirmar, os quatro times e os 20 vínculos são salvos de forma atômica no Supabase. Jogadores comuns podem consultar a distribuição confirmada. Use **ATUALIZAR RODADA** para buscar mudanças feitas por outro organizador.

Sortear novamente uma rodada confirmada pede confirmação. Os times anteriores continuam visíveis para jogadores comuns até o organizador confirmar a nova distribuição. Também é possível ajustar a distribuição confirmada sem sortear novamente: **AJUSTAR TIMES** cria uma cópia para revisão, e **CONFIRMAR TIMES** publica a substituição.

Salvar mudanças na lista de participantes cancela os times confirmados daquela rodada, mediante aviso na interface. Isso evita manter nos times alguém que passou a ser ausente, removido, suplente ou goleiro. Será necessário sortear e confirmar de novo.

## Modelo e segurança

- `rodadas`: nome, data, confirmação, organizador responsável e versão para controle de concorrência.
- `rodada_participantes`: identidade da participação naquela rodada, nome, categoria e presença. `jogador_id` permite associação futura a um perfil permanente; participantes não precisam de conta para serem cadastrados na lista.
- `times`: rodada, número de 1 a 4, nome e campo de cor preparado para uso futuro.
- `time_jogadores`: vínculo do time com a participação na mesma rodada. A chave única impede um participante em dois times da mesma rodada.
- Escrita direta nas quatro tabelas é bloqueada para `anon` e `authenticated`; as RPCs autorizadas fazem a gestão e validação no banco. Leituras exigem usuário ativo; times não confirmados são protegidos por RLS.
- A confirmação verifica novamente elegibilidade, quatro times, cinco pessoas em cada, IDs exclusivos e pertencimento à rodada. Uma versão desatualizada é rejeitada sem sobrescrever o resultado atual.

As telas existentes de Início, Racha, Ranking e Perfil continuam com seus dados de demonstração. A lista persistida desta funcionalidade é cadastrada e consultada na aba **Times**; os dados demonstrativos não são usados no sorteio. Não foram implementados avaliações, estatísticas, ranking real ou lógica de goleiros nas partidas.

## Teste manual após instalar o SQL

1. Com 19 jogadores de linha presentes, confira a mensagem **São necessários 20 jogadores de linha para formar 4 times de 5.** e o bloqueio do sorteio.
2. Com 21, confira **Existem mais de 20 jogadores disponíveis. Ajuste a lista antes de sortear.**
3. Com 20 linhas, dois goleiros e suplentes, sorteie: devem aparecer quatro cards de cinco, sem goleiros, suplentes, ausentes ou removidos.
4. Troque duas pessoas de times diferentes e confira que cada card continua com cinco.
5. Antes da confirmação, entre como jogador comum: nenhum rascunho nem botão de gestão deve aparecer.
6. Confirme como organizador e recarregue. Confira persistência dos mesmos times e visualização como jogador.
7. Sorteie novamente e cancele o aviso; a distribuição atual deve permanecer. Aceite o aviso e confirme a nova distribuição para publicar.
8. Abra a mesma rodada em duas sessões de organizador. Confirme numa delas e tente confirmar na outra: a versão antiga deve ser rejeitada. Atualize a rodada.
9. Altere um participante para ausente ou removido e salve: os times anteriores devem ser invalidados; o sorteio deve exigir novamente 20 aptos.

## Verificações locais

```powershell
npm run build
npm run lint
node --test tests/sorteio.test.mjs
```

Os testes SQL rodam em PostgreSQL isolado via PGlite, sem acesso ao banco real:

```powershell
npm install --prefix "$env:TEMP\fortalaka-sql-check" --no-audit --no-fund @electric-sql/pglite
node tests/sorteio-sql.test.mjs "$env:TEMP\fortalaka-sql-check\node_modules"
```
