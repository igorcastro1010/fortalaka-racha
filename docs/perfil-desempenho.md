# Perfil e médias de desempenho

O cartão do perfil usa Passe, Chute, Velocidade, Defesa e Físico. Cada média considera todas as avaliações recebidas pelo jogador, com igual peso. As notas de cada atributo variam de 0 a 10. A nota geral é a média dos cinco atributos multiplicada por 10, arredondada para inteiro (0–100). O gráfico usa as médias sem arredondamento; os números exibem até uma casa decimal.

Não há notas de demonstração no aplicativo. Sem avaliações, mostrar traço e aviso; zero avaliado é uma nota válida. Foram removidas a nota fixa 8,9 e estatísticas/jogos fictícios do perfil.

## Banco — instalação pendente

Execute todo `supabase/medias-perfil.sql` no SQL Editor após `schema.sql` e `sorteio-times.sql`. O script é reexecutável e não cria avaliações de exemplo. Mantém `profiles.avatar_url` como fonte da foto.

A tabela `avaliacoes_jogadores` armazena racha, avaliado, avaliador e cinco notas. Permite uma avaliação por avaliador/jogador/rodada, sem autoavaliação. RLS permite avaliar apenas companheiros de um mesmo time confirmado de jogadores de linha. Não implementa avaliação de goleiros. A identidade de autoria não pode ser alterada depois da inserção.

A RPC `medias_jogador(p_jogador)` retorna quantidade e médias reais. Usuário consulta suas médias; organizador ativo pode consultar outro jogador. Avaliações individuais não são abertas a terceiros.

A tela para enviar avaliações ainda não existe; este trabalho adiciona o cartão, armazenamento e cálculo necessários. Quando avaliações forem gravadas nessa tabela, o gráfico refletirá as novas médias ao abrir Perfil, voltar à janela ou em até 15 segundos enquanto estiver visível. A foto também é recarregada.

## Validação

Build e lint aprovados. Testes de cálculo cobrem mudança da média e distinção entre ausência e zero. Testes PostgreSQL isolados executam a migração duas vezes e validam média de múltiplas avaliações, edição, privacidade, companheiros, unicidade, faixa das notas e autoria protegida.

Prévia visual a 390px sem transbordamento horizontal nem erro JavaScript, usando dados fictícios apenas na prévia. A imagem de exemplo não representa notas de um usuário real.

```powershell
node --test tests/perfil-medias.test.mjs
node tests/perfil-medias-sql.test.mjs "$env:TEMP\fortalaka-sql-check\node_modules"
```

No aplicativo, abra Perfil. Antes de instalar o SQL, deve aparecer erro de configuração. Depois, sem avaliações, aparece o estado vazio. Com avaliações reais, confira as médias e altere uma nota válida: a nota geral e o radar devem acompanhar a mudança. Não foi feito deploy nesta etapa.

