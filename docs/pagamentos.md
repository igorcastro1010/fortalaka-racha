# Pagamentos da rodada

Pagamento manual: escolher PIX ou Dinheiro nao confirma recebimento. Organizadores
informam o valor individual e marcam Pendente/Recebido em **Racha > Gestao**.
Dados PIX sao editados em **Meu perfil > Configuracoes de pagamento**.

## Banco e publicacao

- Aplicar `supabase/pagamentos.sql` depois de `supabase/correcao-inscricao-lista.sql`
  e suas dependencias. O arquivo e transacional e pode ser reaplicado.
- Coordenar SQL e frontend na mesma publicacao. O app antigo nao envia a forma
  obrigatoria; apos a migration, sua tentativa de entrada sera recusada.
- O frontend novo reconhece as colunas ausentes: preserva consultas e saida da
  lista, mas bloqueia novas entradas ate a migration estar instalada.
- Esta tarefa prepara a migration sem alterar dados reais remotamente. Commit
  e push nao aplicam SQL no Supabase.
- Nao reaplicar SQLs antigos apos esta migration: eles redefinem a RPC e o trigger.

## Persistencia e seguranca

- `racha_participantes`: `forma_pagamento`, `status_pagamento`, `valor_pagamento`.
- Inscricoes antigas mantem metodo/valor nulos e status Pendente; nenhum pagamento
  e presumido. `id` e `created_at` nao mudam ao editar o pagamento.
- Novas inscricoes exigem metodo, inclusive por escrita direta. Repeticoes usam
  a mesma inscricao, protegidas pela trava da rodada e indice unico existente.
- RPCs: `inscricao_rodada`, `alterar_forma_pagamento`, `atualizar_pagamento`.
- Jogador ativo altera apenas seu metodo enquanto a lista esta aberta.
  Somente organizador ativo altera valores/status, inclusive apos encerrar a rodada.
- `configuracoes_pagamento`: registro unico, leitura de perfis ativos, atualizacao
  apenas de organizadores ativos, sem acesso anonimo e com RLS habilitada.
- CPF fica no registro de configuracao, nao em logs, caches do PWA ou constantes
  do bundle. Erros da interface nao ecoam payloads do banco.

## Resumo

Arrecadado soma em centavos somente valores reais marcados Recebido, inclusive
recebimentos de quem saiu da lista. Pendentes considera inscricoes confirmadas
(incluindo suplentes); removidos/ausentes nao criam cobrancas ativas.
Valores desconhecidos sao contados separadamente, nao estimados. Zero e aceito
quando explicitamente cadastrado. Nao ha integracao bancaria, webhook ou conciliacao
automatica; marcar Pendente nao efetua estorno bancario.

## Validacao local

Passar o diretorio de `node_modules` das ferramentas de teste como segundo argumento:

```powershell
node tests/pagamentos.test.mjs <deps>
node tests/payment-summary.test.mjs <deps>
node tests/payment-repository.test.mjs <deps>
node tests/pagamentos-ui.test.mjs <deps>
node tests/inscricao-ui.test.mjs <deps>
npm run lint
npm run build
```

PGlite usa PostgreSQL isolado com roles/RLS. Playwright cobre 360/375/390/430 px,
PIX/copiar, dinheiro, baixa, reversao, configuracoes, ordem, refresh e saida/reentrada.
Concorrencia entre conexoes independentes e aparelhos fisicos exige verificacao
posterior; a fixture local nao representa esses ambientes.

## Revisao final

- Apple Design aplicado como principios web, sem imitar controles nativos: radios
  rotulados, alvos de 48 px, feedback em `role=status`/`role=alert` e detalhes compactos.
- Contraste calculado: texto selecionado `#991b1b` em `#fef2f2`, 7,60:1; acao
  `#c7202b` com branco, 5,72:1; texto secundario `#52525b` em branco, 7,73:1.
  Referencias: `color.md`, `layout.md` (Visual hierarchy), `buttons.md` (Best practices),
  `entering-data.md` e `feedback.md` (Best practices), na skill apple-design local.
- Conferidos screenshots e limites de controles nas quatro larguras. Sem novos
  movimentos, cores decorativas, dependencias de runtime ou alteracoes na navegacao.
- Com Realtime: editor fechado carrega valores atuais ao abrir; rascunho aberto
  e preservado e avisa/bloqueia salvamento se chegar uma alteracao financeira externa.
- Ausentes/removidos continuam disponiveis para registrar recebimentos tardios,
  sem mudar a lista ou inflar a contagem de pendencias ativas.
- Reativacao administrativa com lista fechada mantem o metodo cadastrado. Legado
  sem metodo exige reabrir a lista para escolher, sem adivinhar a forma de pagamento.
