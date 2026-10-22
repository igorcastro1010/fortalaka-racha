# Instalação do Racha Fortalaka

## Ambiente

Use Node.js 24, npm e um projeto Supabase próprio. Na raiz:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica
```

Não versionar o arquivo real de ambiente. Nunca usar service role ou chave secreta em variável pública.

## Banco e migrações

Os scripts estão em [supabase](../supabase). Consulte o [fluxo principal](fluxo-principal.md) para a sequência de dependências e os guias de cada alteração para os pré-requisitos. Não execute todos os SQLs por ordem alfabética e não reaplique arquivos antigos sem conferir o que já está instalado.

Os guias de [estatísticas](partidas-estatisticas.md) e [finalização](finalizar-rodada.md) registram migrações que exigem execução manual. O estado atual do Supabase remoto não foi auditado nesta revisão de documentação. Nenhum SQL foi executado como parte dela.

## Executar

```powershell
npm run dev
```

Abra http://localhost:3000. Autenticação, perfis e permissões dependem da configuração do Supabase e dos scripts instalados.

## Verificar

```powershell
npm run lint
node --test tests/ranking.test.mjs
npm run build
```

O teste de ranking usa o suporte nativo do Node.js 24 a TypeScript. Os testes SQL usam PostgreSQL isolado/PGlite e têm pré-requisitos próprios; veja [partidas e estatísticas](partidas-estatisticas.md). Não execute testes com dados fictícios no banco de produção.

## Publicar

Configure as variáveis públicas no ambiente de hospedagem e as URLs de autenticação no Supabase. Build/deploy não instalam SQL automaticamente. Consulte os guias antes de ativar os fluxos de partidas ou avaliações em um banco existente.
