# Instalação e manutenção da PWA

## Instalar

Abra https://fortalaka-racha.vercel.app em conexão segura. No Chrome/Android ou desktop, use **Instalar Fortalaka** quando o navegador disponibilizar a instalação, ou a opção de instalação do próprio navegador. Em janela anônima, a instalação pode ser bloqueada pelo navegador.

No Safari do iPhone/iPad, use **Compartilhar → Adicionar à Tela de Início**. O convite contextual explica esse caminho. Abrir pelo novo ícone deve usar o modo standalone. O sistema operacional decide splash, formato final do ícone e disponibilidade; não há splash proprietário.

**Agora não** ou recusar o diálogo nativo salva uma preferência local, sem identificador pessoal. O convite não insiste nas próximas visitas. Limpar os dados locais do site também limpa essa preferência. Não é solicitada permissão de notificações.

## Sem conexão

O app aberto informa a perda de conexão; operações dependentes do servidor continuam precisando de internet. Um novo carregamento sem rede mostra apenas a página pública offline, sem informações de partidas ou jogadores. A volta da conexão mostra um aviso e permite tentar novamente. Nenhum formulário é enviado automaticamente.

## Publicar uma atualização

1. Alterou o worker, o documento offline ou um arquivo da lista `PUBLIC_ASSETS`? Incremente `CACHE` em `public/sw.js`. Também incremente quando a versão publicada precisar apresentar o aviso de atualização para abas já abertas.
2. Execute build, lint e testes PWA. Confira `/manifest.webmanifest`, `/sw.js`, `/offline.html` e os ícones sem sessão.
3. Publique o commit autorizado e confira o SHA e o estado READY da implantação.
4. Uma aba com a versão anterior deve mostrar **Nova versão disponível**. Salve alterações antes de clicar em **Atualizar e recarregar**. O primeiro registro não recarrega a página. Uma atualização em outra aba não recarrega esta aba automaticamente.
5. Na ativação, somente caches antigos com prefixo `fortalaka-pwa-` são removidos. Não manter estratégias de cache de HTML privado, RSC, APIs ou respostas Supabase.

Não é preciso SQL, migração ou alteração de RLS. O worker usa a rede para documentos com `cache: no-store`; o fallback só cobre falha de rede, sem ocultar respostas HTTP de erro.

## Verificação manual em aparelhos

- Android: instalar pelo Chrome, conferir escudo/nome, abrir pelo ícone, login autorizado, navegação, refresh e logout; desligar a rede e conferir fallback sem dados privados; reconectar e tentar novamente.
- iPhone: adicionar pelo Safari, conferir ícone, título e abertura standalone; validar notch/home indicator, teclado e rotação no aparelho.
- Desktop: instalar em perfil normal do Chrome, abrir a janela do app e repetir atualização/offline.
- Após nova publicação: manter duas abas antigas, atualizar uma e confirmar que a outra preserva o formulário; depois atualizar a segunda pelo botão.

Esses passos físicos não são substituídos por emulação de viewport, user-agent ou eventos de instalação.

## Comandos locais

```powershell
npm run build
npm run lint
node tests/pwa-icons.test.mjs
node tests/pwa-worker.test.mjs
# Diretório temporário com esbuild e playwright, sem dependência nova no projeto:
node tests/pwa-browser.test.mjs '<diretorio-de-dependencias>'
# Em outro terminal, após o build:
npm run start -- --port 3021
node tests/pwa-production.test.mjs http://localhost:3021
```

Execute build antes dos testes que leem CSS de `.next`, sem fazê-los em paralelo. O teste de navegador usa dados fictícios locais, nunca Supabase. Não desregistre o worker nem apague armazenamento em uma sessão real de outra pessoa para diagnosticar a PWA.
