# RACHA FORTALAKA — Especificação do sorteio de times

Status: regras oficiais implementadas na aba Times; instalação SQL descrita em `instalacao-sorteio-times.md`.

## Escopo

O sorteio considera exclusivamente jogadores de linha aptos a jogar na rodada. Existem dois goleiros fixos no racha, que permanecem separados dos times sorteados. Esta especificação não altera outras funcionalidades.

O sorteio oficial exige exatamente 20 jogadores de linha aptos, distribuídos em 4 times de exatamente 5. Com menos de 20, mostrar **São necessários 20 jogadores de linha para formar 4 times de 5.** Com mais de 20, mostrar **Existem mais de 20 jogadores disponíveis. Ajuste a lista antes de sortear.** Bloquear o sorteio e a confirmação fora desse limite.

## Goleiros fixos

A rodada deve exibir uma seção separada, com o título **GOLEIROS FIXOS**, mantida visível no topo da tela de sorteio e do resultado.

Exemplo de nomes, sem fixá-los no código:

- Gabriel Sol
- Kauan Gustavo

Os dois goleiros fixos:

- Não entram na lista de jogadores disponíveis para sorteio.
- Não participam de nenhum sorteio ou novo sorteio.
- Não são atribuídos automaticamente a qualquer time.
- Não contam na quantidade de jogadores de cada time nem no total disponível para sorteio.
- Permanecem identificados e visíveis na rodada como goleiros fixos.

Os times desta funcionalidade contêm apenas jogadores de linha; a edição manual também deve respeitar essa restrição.

## Participantes da rodada e elegibilidade

O modelo deve distinguir, por participante da rodada, as categorias:

| Categoria | Significado | Entra no sorteio? |
| --- | --- | --- |
| `goleiro_fixo` | Um dos dois goleiros fixos | Não |
| `linha` | Jogador de linha | Somente se estiver apto a jogar |
| `suplente` | Participante na condição de suplente | Não enquanto permanecer nessa condição |

A categoria e a condição de estar apto devem ser identificáveis no banco/modelo da rodada. O nome de campos e a migração serão definidos na implementação, preservando o modelo existente quando possível.

A lista disponível, a contagem e a entrada do algoritmo devem usar o mesmo critério: participante com categoria `linha` **e** apto para jogar na rodada. Nenhuma pessoa pode aparecer duplicada ou em mais de um time. Um suplente somente se torna elegível após passar à condição de `linha` e estar apto, conforme o fluxo da rodada.

## Tela de sorteio

Exibir o texto **Jogadores disponíveis para sorteio**, seguido da quantidade de jogadores de linha elegíveis.

Exemplo: **20 jogadores de linha disponíveis**.

O botão de ação deve usar o texto **SORTEAR TIMES**. A lista nunca deve misturar goleiros fixos ou suplentes com jogadores de linha disponíveis.

## Resultado

Manter **GOLEIROS FIXOS** no topo, separado dos times. Cada time deve listar somente jogadores de linha elegíveis, e suas contagens devem considerar somente esses jogadores.

Exemplo parcial de dois dos quatro times obrigatórios:

**GOLEIROS FIXOS**

- Gabriel Sol
- Kauan Gustavo

**TIME 1**

- Igor
- PH
- Tarcisio
- Dedé
- Caiox

**TIME 2**

- Jack
- Hamilton
- Ednardo
- Levi
- Bruno

O mesmo formato se aplica a Time 3 e Time 4. Cada time contém exatamente 5 jogadores de linha. Ajustes manuais usam troca de um jogador por outro de um time diferente, preservando esse tamanho.

## Permissões e confirmação

| Ação | `organizador` | `jogador` |
| --- | --- | --- |
| Realizar sorteio | Permitido | Bloqueado |
| Sortear novamente | Permitido | Bloqueado |
| Alterar os times manualmente | Permitido | Bloqueado |
| Confirmar os times | Permitido | Bloqueado |
| Visualizar times confirmados | Permitido | Permitido |
| Visualizar rascunhos de times | Permitido | Bloqueado |

As permissões devem ser verificadas na interface e na camada que executa/persiste as ações; ocultar botões não é suficiente. Somente usuários com `role = organizador` podem executar as quatro ações de gestão.

Resultados de sorteio e alterações manuais devem permanecer como rascunho até a confirmação pelo organizador. Jogadores comuns visualizam somente times confirmados. Um novo sorteio ou uma alteração não pode expor um rascunho como resultado confirmado.

## Avaliações e limites desta etapa

- Não implementar nem definir a regra final de avaliação dos goleiros nesta etapa.
- A avaliação futura dos jogadores de linha continuará baseada nos companheiros do próprio time.
- Não alterar outras funcionalidades, regras de avaliação, login, cadastro ou organização da rodada nesta etapa.
- A instalação no banco deve usar `supabase/sorteio-times.sql`; não implementar avaliações nesta etapa.

## Critérios de aceite para a implementação futura

1. Uma rodada com 20 jogadores de linha aptos e dois goleiros fixos mostra **20 jogadores de linha disponíveis**, e não 22.
2. Goleiros fixos e suplentes não aparecem na lista disponível nem nos times sorteados, inclusive após novo sorteio ou edição manual.
3. Jogadores de linha não aptos também ficam fora da lista, da contagem e do resultado.
4. Os dois goleiros permanecem visíveis na seção **GOLEIROS FIXOS** no topo, antes e depois do sorteio.
5. Cada jogador sorteado aparece em somente um time; nenhuma contagem de time inclui goleiros.
6. Apenas organizadores podem sortear, sortear novamente, editar e confirmar, inclusive por acesso direto à camada de persistência.
7. Jogadores comuns conseguem visualizar os times confirmados, mas não os rascunhos nem as ações de gestão.
8. Nenhuma regra final de avaliação de goleiros é implementada e as demais funcionalidades permanecem preservadas.
