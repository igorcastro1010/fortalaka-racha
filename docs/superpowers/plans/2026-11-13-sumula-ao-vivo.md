# Sumula ao vivo

Design aprovado pelo usuario a partir do mockup: placar, abas dos times,
gols e assistencias na mesma linha, participantes secundarios, desfazer e finalizar.

Implementacao:
1. Componente LiveMatchScoring para partida aberta, reutilizando RPC com versao.
2. Persistir cada toque; bloquear repeticao durante escrita; falha exige releitura
   antes de novo envio (resultado de rede pode ser ambiguo). Nunca repetir sozinho.
3. Desfazer ultimo envio com controle de versao; placar separado da autoria dos gols.
4. Preservar editor historico, confirmacoes, penaltis e sugestao aos dois gols.
5. Validar navegador 360/375/390/430, regressao, build, lint e Graphify.
6. Commit/push dos arquivos do escopo; sem SQL novo nem deploy.

Validado: build, lint, navegacao completa, testes PostgreSQL de empates e
Playwright/CDP em 360/375/390/430. Testados salvar, desfazer, corrigir,
trocar de tela, duplo clique, falha de leitura depois de escrever e versao
obsoleta. Erros tecnicos permanecem fora da UI. Evidencia visual em diretorio
temporario, sem arquivos de teste ou dados ficticios em producao.

O placar continua independente dos gols individuais. Ajuste de participacao
nao remove eventos silenciosamente: corrija os eventos antes de desmarcar.
Historico mantem o editor existente e as restricoes apos encerrar a rodada.
Revisao visual: identidade atual, avatar existente, botoes de 44px e nomes
longos sem overflow; sem dependencia nova. Sem teste em aparelho fisico.
