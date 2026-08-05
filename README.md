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

## Persistência

O ranking de pontuações é salvo em `localStorage` no navegador (chave `arquiteto_ranking_v1`).
