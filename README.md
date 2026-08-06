# O Arquiteto — Escape Room de Engenharia de Requisitos

Jogo educacional em HTML5, CSS3 e JavaScript puro (sem frameworks, sem bibliotecas externas).

## Como jogar

Abra `index.html` em qualquer navegador moderno. Não precisa de servidor, build ou instalação.

## Estrutura

- `index.html` — telas do jogo (menu, instruções, créditos, ranking, intro, HUD, fases, game over, vitória).
- `style.css` — tema visual (CRT, glitch, scanlines, vinheta, animações, responsividade).
- `script.js` — toda a lógica: estado do jogo, cronômetro, integridade do projeto, motor de fases, áudio e efeitos.
- `assets/sounds/` e `assets/images/` — pastas reservadas para quem quiser substituir os efeitos sintetizados por arquivos reais (samples de áudio, texturas, sprites). Por padrão o jogo **não depende de nenhum arquivo binário**: todos os sons são gerados em tempo real via Web Audio API e todos os efeitos visuais (ruído, glitch, névoa) são gerados via CSS/Canvas, para manter o projeto 100% autocontido e fácil de entregar.

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



## Persistência

O ranking de pontuações e as contas de usuário (apelido + senha) são salvos em `localStorage` no navegador como fallback, e também podem ser configurados como **globais** (visíveis/acessíveis de qualquer aparelho), usando o [JSONBin.io](https://jsonbin.io) como banco de dados gratuito na nuvem — a mesma configuração serve para os dois.

### Como ativar o ranking e as contas globais

1. Crie uma conta grátis em https://jsonbin.io.
2. Clique em **"Create Bin"** e cole o conteúdo inicial: `{ "scores": [], "users": [] }`. Salve e anote o **Bin ID**.
3. Vá em **API Keys**, crie uma **Access Key** (não a Master Key) restrita a esse bin específico, com permissões apenas de **Read** e **Update**.
4. Abra `script.js`, procure por `JSONBIN_BIN_ID` e `JSONBIN_ACCESS_KEY` (seção "GAME OVER / VITÓRIA / RANKING") e substitua os placeholders pelos valores obtidos.

Enquanto esses dois campos não forem preenchidos, o jogo detecta isso automaticamente e usa só dados locais — nada quebra. Depois de configurado, contas de cadastro e pontuações passam a ser compartilhadas entre qualquer navegador/aparelho que acessar o jogo.

**Sobre a segurança da senha**: como o site não tem servidor próprio, a senha é transformada em hash (SHA-256) no próprio navegador antes de ser enviada — ela nunca é salva ou trafega em texto puro. Ainda assim, a chave de acesso ao JSONBin fica visível no código-fonte (normal para esse tipo de serviço) e a Access Key restrita limita o dano possível a "ler e atualizar esse bin específico". Para um projeto acadêmico isso é um nível de segurança adequado; não seria para um sistema de produção com dados sensíveis reais.
