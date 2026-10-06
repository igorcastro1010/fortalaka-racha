# Instalação e validação do sorteio e das fotos

## Supabase — pendente nesta entrega

No SQL Editor do projeto configurado em `.env.local`:

1. A estrutura de autenticação de `supabase/schema.sql` deve existir.
2. A estrutura de rodada de `supabase/sorteio-times.sql` deve existir. Execute esse arquivo se ainda não foi instalado.
3. Execute **todo** `supabase/validacao-sorteio-avatars.sql` por último. Ele cria RPCs transacionais, versão da rodada, validação, proteção da lista e configuração de avatars. Pode ser executado novamente.

O novo SQL foi validado em PostgreSQL isolado, sem ser aplicado ao Supabase remoto. Não cria contas nem participantes de teste no banco real. Reexecutar o SQL antigo depois do novo restaura grants antigos: nesse caso, execute novamente o novo arquivo por último.

O script configura o bucket público `avatars`, MIME types PNG/JPEG/WebP e limite de 2 MiB. A URL da foto é pública; somente o dono escreve na pasta `auth.uid()/`. A foto fica exclusivamente em `profiles.avatar_url`.

Confira policies antigas do Storage: policies permissivas são combinadas por OR. O script substitui somente `fortalaka_avatars_*`, preservando policies de outros recursos. Remova ou restrinja qualquer policy antiga que permita gravar, alterar ou apagar fotos de terceiros em `avatars`.

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'avatars';
```

As policies existentes de `profiles` devem continuar limitando UPDATE ao próprio usuário, sem permitir alterar role ou active. As tabelas de times são alteradas pelas novas RPCs. A revisão remota das policies existentes e o upload contra o serviço real de Storage continuam pendentes.

## Teste manual no navegador

1. Entre como organizador ativo. Em Racha, abra a lista, adicione linhas confirmados, dois goleiros e um suplente. Feche a lista.
2. Em Times, confira a contagem apenas de linhas e sorteie. Saia para Racha e volte: deve continuar igual.
3. Atualize a página; depois feche e abra o navegador. Entre novamente se necessário. Confira os mesmos times.
4. Sorteie novamente, saia e volte: a nova distribuição permanece, sem duplicatas.
5. Use Ajustar times e selecione duas pessoas de times diferentes. Saia e volte: a troca permanece.
6. Confirme e recarregue. Os mesmos times e jogadores permanecem. Entre como jogador: times confirmados aparecem sem controles. Rascunhos ficam ocultos.
7. Repita com 4, 8, 10, 13, 20 e 23 linhas. Máximo cinco por time; diferença entre tamanhos até uma pessoa.
8. Em Perfil, envie PNG/JPEG/WebP de até 2 MiB. Recarregue e confira a foto na lista e nos times. Confira iniciais sem foto e numa URL que retorna erro.
9. Confira loading e falha de rede: não mostrar falso estado vazio nem sucesso ao falhar. Use Tentar novamente.
10. Em duas sessões de organizador, salve numa e tente salvar a versão antiga na outra: a versão desatualizada deve ser rejeitada.

## Verificações locais

```powershell
npm run build
npm run lint
node --test tests/sorteio.test.mjs
npm install --prefix "$env:TEMP\fortalaka-sql-check" --no-audit --no-fund @electric-sql/pglite
node tests/sorteio-sql.test.mjs "$env:TEMP\fortalaka-sql-check\node_modules"
```

Os testes SQL usam os scripts reais em PostgreSQL isolado, com stubs de auth/storage. Para testar componentes reais no navegador sem acessar dados do Supabase remoto:

```powershell
npm install --prefix "$env:TEMP\fortalaka-ui-check" --no-audit --no-fund esbuild
node tests/preview-sorteio.mjs "$env:TEMP\fortalaka-ui-check\node_modules" "$env:TEMP\fortalaka-sql-check\node_modules"
```

Abra `http://127.0.0.1:3011/` para organizador e `http://127.0.0.1:3011/?role=jogador` para jogador. Identidades falsas e apenas locais. Navegação e recargas preservam o banco enquanto o processo estiver rodando; reiniciar a prévia descarta os dados de teste. A prévia não verifica o serviço remoto de Supabase Storage.
