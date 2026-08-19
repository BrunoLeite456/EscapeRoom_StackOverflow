# O Arquiteto — Escape Room de Engenharia de Requisitos

Jogo educacional em HTML5, CSS3 e JavaScript puro (sem frameworks, sem bibliotecas externas).

## Como jogar

Abra `index.html` em qualquer navegador moderno. Não precisa de servidor, build ou instalação.

## Estrutura

- `index.html` — telas do jogo (menu, instruções, créditos, ranking, intro, HUD, fases, game over, vitória).
- `style.css` — tema visual (CRT, glitch, scanlines, vinheta, animações, responsividade).
- `script.js` — toda a lógica: estado do jogo, cronômetro, integridade do projeto, motor de fases, áudio e efeitos.
- `assets/sounds/` — contém a única exceção ao autocontido total do projeto: `nucleo-em-colapso.m4a` (+ fallback `.mp3`), a trilha real do confronto final com O Arquiteto no modo Impossível (ver seção abaixo). Todo o resto do jogo continua sem depender de nenhum arquivo binário: os demais sons são gerados em tempo real via Web Audio API e todos os efeitos visuais (ruído, glitch, névoa) são gerados via CSS/Canvas.
- `assets/images/` — pasta reservada para quem quiser substituir texturas/sprites sintetizados por arquivos reais; não usada por padrão.

## Personagem

**O Arquiteto** é uma inteligência original criada para este projeto — não uma cópia de nenhum personagem de mídia existente. Ele conduz a narrativa e pune erros de especificação de requisitos com glitches, alarmes e mensagens.

## Conteúdo pedagógico

O jogo ensina, na prática, a diferenciar:

- Requisitos Funcionais x Não Funcionais
- Requisito x Opinião x Desejo do Cliente x Informação Irrelevante
- Casos de Uso (atores e ações)
- Modelo Entidade-Relacionamento (entidades, PK, FK, cardinalidade)
- Gestão de mudança de escopo (requisito novo x alteração de requisito existente)

## Requisitos funcionais opcionais implementados

Além do escape room em si, o projeto implementa os seguintes requisitos funcionais opcionais da atividade:

- **RF01 — Login de Usuário**: tela de acesso obrigatória com **cadastro e login reais** (apelido + senha). O apelido precisa ser único; a senha nunca é guardada em texto puro (é transformada com SHA-256 no navegador antes de salvar). Login e cadastro reaproveitam o mesmo JSONBin do ranking global — ou seja, assim que você configurar o JSONBin (ver seção abaixo), dá pra acessar a mesma conta em qualquer aparelho. Sem configurar, as contas ficam só no navegador local.
- **RF02 — Nome do usuário logado**: exibido em um badge fixo no canto superior direito em todas as telas de navegação (fora da tela de jogo, mantida minimalista de propósito).
- **RF03 — Menu de navegação lateral**: acessível nas telas de Dashboard, Menu, Ranking, Instruções, Créditos e Seleção de Dificuldade.
- **RF04 — Dashboard com indicadores**: tela inicial após o login, com 4 indicadores (partidas jogadas, melhor pontuação, documentos recuperados no histórico, taxa de acerto média), calculados a partir do `localStorage`.
- **RF05 — Acesso a relatórios**: o Ranking (acessível pelo menu lateral) funciona como a área de relatórios do sistema.
- **RF06 — Listagem em tabela**: o Ranking é uma tabela real com colunas Nome, Dificuldade, Pontuação, Data e Status.
- **RF07 — Filtro/pesquisa em tabelas**: a tabela de ranking tem pesquisa por nome e filtro por dificuldade.
- **RF08 — Logout**: disponível no badge de sessão e no menu lateral ("Desconectar"), volta para a tela de login.

**RF09 e RF10 (clicar e acumular pontos / elemento que aumenta de velocidade) não foram implementados** — optamos por manter a coerência da experiência como um escape room narrativo/educacional em vez de misturar com uma mecânica de reflexo/clicker, que destoaria do restante do projeto. Em compensação, o projeto define requisitos funcionais próprios ligados ao seu domínio (ex: "o sistema deve cronometrar cada fase proporcionalmente ao número de perguntas", "o sistema deve escalar a corrupção visual do terminal conforme a integridade do projeto cai"), permitido pelo enunciado da atividade.



## Fase final (chefão) na Difícil

Não existe mais uma "Fase 5" jogável, nem uma tela de fase final, nem uma tela de vitória separada. O confronto com **O Arquiteto** acontece só narrativamente, dentro da própria cutscene de revelação do C.O.N.T.R.A.: depois da reviravolta, a mesma tela anuncia que o **modo Impossível foi liberado**, avisa que **"O Arquiteto está à sua espera"** e, logo abaixo dessa mensagem, na mesma tela, já mostra o placar da partida (tempo, erros, integridade, precisão, pontuação) para salvar no ranking. O Arquiteto **não é derrotado** nesse ponto — a queda dele só acontece de fato no Modo Impossível. A única exceção é o Final Secreto (zero erros na partida inteira), que ainda usa a tela de vitória própria, por ser um desfecho narrativo à parte.

## Modo secreto: Impossível

Ao vencer uma partida na dificuldade **Difícil**, uma quarta opção — **IMPOSSÍVEL** — é liberada na tela de seleção de dificuldade (fica salva no `localStorage`, então some só se você limpar os dados do site). Escolher essa dificuldade não abre o escape room: pula direto pra um minigame de ritmo estilo Guitar Hero em **tela cheia** (sem o "PC" quebrado, sem HUD de integridade, sem perguntas de requisitos). São 4 pistas (teclas `D` `F` `J` `K`) e uma barra de vida.

O cronômetro das notas usa a posição real de reprodução do áudio (`audio.currentTime`), não um timer separado — assim o chart nunca dessincroniza da música, mesmo com pequenas variações de latência ao iniciar a faixa. O chart em si (quando cada nota cai e em qual pista) foi gerado **offline, por análise de áudio da faixa de verdade**: as batidas reais  viraram as notas, e a pista de cada uma foi escolhida pela banda de frequência dominante daquele instante (grave/médio-grave/médio-agudo/agudo → pistas `D` `F` `J` `K`), com um leve balanceamento pra não repetir demais a mesma pista.

A fase toca uma trilha real, **"Núcleo em Colapso"** — composição original gravada especificamente para este confronto (arquivo em `assets/sounds/nucleo-em-colapso.m4a`, com fallback `.mp3` para navegadores sem suporte a AAC), tocada por um `<audio>` comum em vez de sintetizada ao vivo. A faixa é tocada direto — sem passar pelo grafo do Web Audio API — o que evita problemas de CORS ao abrir o jogo direto do disco (sem servidor). Andamento reais foram detectados por análise de áudio e usados pra remapear todo o ritmo da fase em cima da forma de onda de verdade, em vez de um andamento aproximado.

Conforme a música avança, o palco vai "quebrando" progressivamente em **4 patamares** (calculados sobre os segundos reais da faixa, não sobre um progresso genérico): calmo até ~20s, sobe em ~20s/60s/120s e entra na reta final mais pesada em ~155s, pouco antes do clímax terminar em ~169,5s. Cada patamar dispara uma rajada de glifos corrompidos e um popup de erro de sistema (mensagens tipo `ARQUITETO.SYS — FALHA DE SEGMENTAÇÃO`), além de mover o indicador de "NÚCLEO DO ARQUITETO" no HUD. Por cima disso, **cada batida real da música** (não só as transições de patamar) dispara um pulso visual no palco, e a partir do patamar 2 isso vira uma chuva contínua de bugs, flicker cromático e tremores nas batidas fortes — o palco literalmente se desfazendo no ritmo da trilha. Ao vencer a música, uma sequência final de colapso (tremores em cascata, rajada grande de bugs, mais popups de erro) é bem mais intensa que qualquer patamar anterior — e essa é exatamente a hora em que a faixa real, sozinha, já está entrando no seu trecho mais quieto: o interlúdio melancólico da queda de O Arquiteto é a cauda de verdade da música, tocando por baixo do colapso e da tela de resultado, não mais um trecho sintetizado à parte.

### A Lista

Toda vez que alguém vence o modo Impossível pela primeira vez, o apelido entra n'**A Lista** — a ordem de quem já derrotou O Arquiteto (não é ranking por pontuação; é só a ordem de chegada, sem repetir nome). Ela aparece em três lugares:

- **Na tela de vitória do Impossível**, no instante em que você vence: se é a sua primeira vez, seu nome é "escrito" com efeito de máquina de escrever ao final da lista; se você já estava nela, a lista só aparece normalmente (sem o efeito).
- **Ao lado da própria opção IMPOSSÍVEL**, na tela de seleção de dificuldade: um botão "📜 A LISTA" abre um painel com a lista atual (sem efeito de escrita — isso é exclusivo do momento da vitória).
- **Na tela de Créditos**: a mesma lista, sempre atualizada, sem precisar ter jogado.

Assim como o ranking, A Lista é salva no `localStorage` (funciona offline) e, se o JSONBin estiver configurado (ver seção abaixo), também fica global — visível em qualquer aparelho.

## Persistência

O ranking de pontuações e as contas de usuário (apelido + senha) são salvos em `localStorage` no navegador como fallback, e também podem ser configurados como **globais** (visíveis/acessíveis de qualquer aparelho), usando o [JSONBin.io](https://jsonbin.io) como banco de dados gratuito na nuvem — a mesma configuração serve para os dois.

### Como ativar o ranking e as contas globais

1. Crie uma conta grátis em https://jsonbin.io.
2. Clique em **"Create Bin"** e cole o conteúdo inicial: `{ "scores": [], "users": [] }`. Salve e anote o **Bin ID**.
3. Vá em **API Keys**, crie uma **Access Key** (não a Master Key) restrita a esse bin específico, com permissões apenas de **Read** e **Update**.
4. Abra `script.js`, procure por `JSONBIN_BIN_ID` e `JSONBIN_ACCESS_KEY` (seção "GAME OVER / VITÓRIA / RANKING") e substitua os placeholders pelos valores obtidos.

Enquanto esses dois campos não forem preenchidos, o jogo detecta isso automaticamente e usa só dados locais — nada quebra. Depois de configurado, contas de cadastro e pontuações passam a ser compartilhadas entre qualquer navegador/aparelho que acessar o jogo.

**Sobre a segurança da senha**: como o site não tem servidor próprio, a senha é transformada em hash (SHA-256) no próprio navegador antes de ser enviada — ela nunca é salva ou trafega em texto puro. Ainda assim, a chave de acesso ao JSONBin fica visível no código-fonte (normal para esse tipo de serviço) e a Access Key restrita limita o dano possível a "ler e atualizar esse bin específico". Para um projeto acadêmico isso é um nível de segurança adequado; não seria para um sistema de produção com dados sensíveis reais.

## Resetar ou consolidar o ranking

O progresso de cada conta (dificuldades secretas desbloqueadas e as estatísticas do dashboard) é salvo por conta — não pelo navegador. Ao entrar (login ou cadastro) com o JSONBin configurado, o jogo sincroniza automaticamente: puxa o que essa conta já tinha desbloqueado em outras máquinas para este navegador, e sempre que algo novo é desbloqueado aqui, manda para o JSONBin também. Assim, uma conta que já venceu a Difícil em um computador aparece com "O Arquiteto" liberado em qualquer outro navegador em que fizer login — sem precisar vencer de novo.

O ranking já mantém automaticamente só o **recorde** de cada jogador por dificuldade (uma pontuação nova só substitui a salva se for maior). A cada carregamento do jogo, o ranking local (deste navegador) passa por uma consolidação automática e silenciosa que remove qualquer entrada antiga/duplicada que tenha sobrado de antes dessa regra — não precisa fazer nada pra isso acontecer.

Para o ranking **global** (JSONBin, compartilhado entre todo mundo que joga) ou pra **apagar tudo**, isso não roda sozinho de propósito — é uma ação manual, feita pelo console do navegador (F12 → aba "Console"), com o jogo aberto:

```js
ArquitetoAdmin.consolidarLocal()        // limpa duplicatas no ranking deste navegador (já roda sozinho, mas pode rodar de novo a qualquer momento)
await ArquitetoAdmin.consolidarGlobal() // mesma limpeza, só que no ranking global (JSONBin) — afeta todo mundo, precisa de rede
ArquitetoAdmin.resetarLocal()           // apaga TODO o ranking e o Salão da Fama deste navegador
await ArquitetoAdmin.resetarGlobal()    // apaga TODAS as pontuações e o Salão da Fama do ranking global — irreversível
await ArquitetoAdmin.resetarTudo()      // local + global de uma vez
```

Pra tirar só **um registro específico** em vez do ranking inteiro (ex: um nome ou pontuação de teste que ficou salva):

```js
ArquitetoAdmin.removerEntradaLocal('NOME', 'dificil')          // remove esse jogador dessa dificuldade, só do ranking local
await ArquitetoAdmin.removerEntradaGlobal('NOME', 'dificil')   // mesma remoção, no ranking global (JSONBin)
ArquitetoAdmin.removerDoHallLocal('NOME')                      // remove do Salão da Fama (modo Impossível) local
await ArquitetoAdmin.removerDoHallGlobal('NOME')               // remove do Salão da Fama global
```

As dificuldades válidas são `facil`, `medio` ou `dificil` (o Salão da Fama não usa dificuldade, só nome).

Nenhuma dessas ações mexe nas contas de usuário (apelido/senha) — só no ranking e no Salão da Fama.

