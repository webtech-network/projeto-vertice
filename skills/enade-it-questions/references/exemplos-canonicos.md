# Exemplos Canônicos — ENADE IT Questions

Este arquivo contém exemplos validados de questões no padrão ENADE para cursos de TI.
Eles funcionam como **régua de qualidade**, não como molde temático.
Use-os para calibrar: nível de rigor técnico, profundidade da chave de resposta,
estrutura dos distratores, paralelismo entre alternativas e, nas discursivas,
delimitação dos itens e objetividade do Padrão de Resposta.

---

## Modelo RU — Resposta Única

**Disciplina/Tema:** Controle de Versão — Git
**Modelo:** RU
**Nível:** Básico

**[Texto-base]**
Durante o desenvolvimento de um projeto web, um estudante utiliza o Git para versionar
seu código. Após modificar alguns arquivos, ele deseja registrar essas alterações no
repositório local com uma mensagem descritiva.

**[Enunciado]**
Qual comando do Git permite registrar as alterações no repositório local após
adicioná-las à área de staging?

**[Alternativas]**
A) git push
B) git add
C) git commit
D) git clone
E) git status

**[Gabarito]** Letra C

**[Chave de Resposta]**
- **Alternativa A:** (Incorreta). O comando `git push` envia commits do repositório local para um repositório remoto — é uma etapa posterior ao commit.
- **Alternativa B:** (Incorreta). O comando `git add` adiciona arquivos à área de staging (preparação), mas não registra nenhum histórico no repositório.
- **Alternativa C:** (Correta). Alternativa correta. O comando `git commit` registra as alterações presentes na staging area no histórico do repositório local, acompanhado de uma mensagem descritiva. Como aprofundamento, boas práticas recomendam mensagens no imperativo (ex: "Implementa tela de login") e commits atômicos — cada commit representando uma única unidade lógica de mudança.
- **Alternativa D:** (Incorreta). O comando `git clone` cria uma cópia local de um repositório remoto — utilizado na configuração inicial do ambiente.
- **Alternativa E:** (Incorreta). O comando `git status` exibe o estado atual do repositório (arquivos modificados, staged, não rastreados), sem realizar nenhuma operação de registro.

---

## Modelo CM — Complementação Múltipla

**Disciplina/Tema:** Desenvolvimento Web — HTML Semântico
**Modelo:** CM
**Nível:** Intermediário

**[Texto-base]**
Uma equipe de desenvolvimento está construindo a home-page de um portal de notícias.
O desenvolvedor júnior escreveu o seguinte trecho de código HTML:

```html
<div class="cabecalho">
  <div class="logo">Portal News</div>
  <div class="menu">
    <a href="/">Início</a>
    <a href="/esportes">Esportes</a>
    <a href="/tecnologia">Tecnologia</a>
  </div>
</div>

<div class="conteudo-principal">
  <div class="noticia">
    <div class="titulo-noticia">Novo framework JS é lançado</div>
    <div class="texto-noticia">Lorem ipsum dolor sit amet...</div>
  </div>
</div>

<div class="rodape">
  <div class="copyright">&copy; 2025 Portal News</div>
</div>
```

Durante a revisão de código, o tech lead solicitou que o HTML fosse reescrito
utilizando tags semânticas adequadas. Considere as seguintes afirmações sobre
a refatoração correta:

I. A `<div class="cabecalho">` deve ser substituída por `<header>`, e a
`<div class="menu">` deve ser substituída por `<nav>`, pois essas tags comunicam
ao navegador e a leitores de tela a função estrutural desses blocos.

II. A `<div class="noticia">` deve ser substituída por `<article>`, pois essa tag
representa um conteúdo independente e autocontido que faz sentido por si só.

III. A `<div class="conteudo-principal">` deve ser substituída por `<section>`,
pois `<main>` é utilizada apenas dentro de `<article>`.

IV. A `<div class="rodape">` deve ser substituída por `<footer>`, pois essa tag
representa o rodapé do documento ou de uma seção.

Com base na análise do código e nos princípios de HTML semântico, as afirmações
corretas são:

**[Alternativas]**
A) I e II, apenas.
B) I, II e IV, apenas.
C) II e III, apenas.
D) I, III e IV, apenas.
E) I, II, III e IV.

**[Gabarito]** Letra B

**[Chave de Resposta]**
- **Alternativa A:** (Incorreta). Embora I e II estejam corretas, omite a afirmação IV, que também é verdadeira — `<footer>` é a tag semântica adequada para rodapés.
- **Alternativa B:** (Correta). Alternativa correta. As afirmações I, II e IV descrevem corretamente o uso de `<header>`, `<nav>`, `<article>` e `<footer>`. A afirmação III é falsa: `<main>` representa o conteúdo principal do documento e deve ser usada de forma independente — a especificação HTML recomenda que exista apenas um `<main>` por página e que ele não seja descendente de `<article>`, `<aside>`, `<footer>`, `<header>` ou `<nav>`. Como aprofundamento, o uso correto de tags semânticas impacta diretamente a acessibilidade (ARIA landmarks) e o SEO.
- **Alternativa C:** (Incorreta). Exclui as afirmações I e IV, que são corretas, e inclui a III, que contém um erro conceitual sobre o uso de `<main>`.
- **Alternativa D:** (Incorreta). Inclui a afirmação III, que é falsa, e omite a II, que é correta.
- **Alternativa E:** (Incorreta). Inclui a afirmação III como verdadeira, mas `<main>` pode e deve ser usada fora de `<article>` para representar o conteúdo principal da página.

---

## Modelo AR — Asserção-Razão

**Disciplina/Tema:** Desenvolvimento Web — Arquitetura Web e Protocolos
**Modelo:** AR
**Nível:** Intermediário

**[Texto-base]**
Em uma aplicação web moderna, quando um usuário digita `https://www.exemplo.com/produtos`
na barra de endereços do navegador e pressiona Enter, uma série de etapas ocorre
envolvendo o protocolo HTTP, resolução DNS e a arquitetura cliente-servidor.

Analise as asserções a seguir e a relação proposta entre elas:

**Asserção I:** Em cenários usuais de acesso via nome de domínio, o navegador realiza
uma consulta DNS para resolver o nome de domínio `www.exemplo.com` em um endereço IP
antes de estabelecer a conexão HTTP com o servidor.

**PORQUE**

**Asserção II:** O protocolo HTTP opera sobre TCP/IP, que utiliza endereços IP para
identificar o servidor de destino, sendo a resolução de nomes uma etapa prévia e
necessária para o estabelecimento da conexão TCP.

**[Enunciado]**
A respeito dessas asserções, assinale a alternativa correta.

**[Alternativas]**
A) As asserções I e II são verdadeiras, e a II é uma justificativa correta da I.
B) As asserções I e II são verdadeiras, mas a II não é uma justificativa correta da I.
C) A asserção I é uma proposição verdadeira, e a II é uma proposição falsa.
D) A asserção I é uma proposição falsa, e a II é uma proposição verdadeira.
E) As asserções I e II são proposições falsas.

**[Gabarito]** Letra A

**[Chave de Resposta]**
- **Alternativa A:** (Correta). Alternativa correta. A asserção I descreve corretamente que a resolução DNS precede a conexão HTTP — o navegador precisa descobrir o IP do servidor antes de comunicar-se com ele. A asserção II justifica a I ao explicar que o HTTP opera na camada de aplicação sobre TCP/IP, e o TCP exige um endereço IP para estabelecer a conexão, tornando a resolução DNS uma etapa obrigatória. Como aprofundamento: após a resolução DNS, o navegador realiza o TCP handshake (SYN → SYN-ACK → ACK) e, em HTTPS, também o TLS handshake, antes de enviar a requisição HTTP.
- **Alternativa B:** (Incorreta). A asserção II é sim uma justificativa válida da I — ela explica tecnicamente por que a resolução DNS é necessária antes da conexão HTTP.
- **Alternativa C:** (Incorreta). A asserção II é verdadeira: o HTTP de fato opera na camada de aplicação e depende de endereços IP via TCP/IP para a comunicação.
- **Alternativa D:** (Incorreta). A asserção I é verdadeira — a resolução DNS é uma etapa real e necessária no fluxo de requisição web por nome de domínio.
- **Alternativa E:** (Incorreta). Ambas as asserções são tecnicamente corretas e fundamentadas na arquitetura de protocolos da internet.

---

## Modelo INT — Interpretação

**Disciplina/Tema:** Desenvolvimento Web — CSS Box Model e Seletores
**Modelo:** INT
**Nível:** Avançado

**[Texto-base]**
Um desenvolvedor criou o seguinte código CSS para estilizar cards de produtos
em uma loja virtual:

```css
/* Trecho 1 */
.card {
  width: 300px;
  padding: 20px;
  border: 5px solid #ccc;
  margin: 10px;
  box-sizing: content-box;
}

/* Trecho 2 */
.container .card .title {
  font-size: 18px;
  color: #333;
}

/* Trecho 3 */
.card > p {
  color: #666;
  margin-bottom: 15px;
}
```

O HTML correspondente é:

```html
<div class="container">
  <div class="card">
    <h3 class="title">Produto A</h3>
    <p>Descrição do produto A.</p>
    <div class="details">
      <p>Detalhes adicionais.</p>
    </div>
  </div>
</div>
```

**[Enunciado]**
Com base na análise dos trechos CSS e do HTML apresentado, a largura total ocupada
horizontalmente por cada card e o comportamento dos seletores são, respectivamente:

**[Alternativas]**
A) A largura total horizontal é 300px, e o seletor do Trecho 3 aplica estilo a todos os parágrafos dentro de `.card`, incluindo o parágrafo dentro de `.details`.
B) A largura total horizontal é 350px, e o seletor do Trecho 3 aplica estilo a todos os parágrafos dentro de `.card`, incluindo o parágrafo dentro de `.details`.
C) A largura total horizontal é 370px, e o seletor do Trecho 3 aplica estilo apenas ao parágrafo filho direto de `.card`, sem afetar o parágrafo dentro de `.details`.
D) A largura total horizontal é 350px, e o seletor do Trecho 2 aplica estilo ao `.title` apenas quando ele é filho direto de `.card`.
E) A largura total horizontal é 370px, e o seletor do Trecho 2 aplica estilo ao `.title` apenas quando ele é filho direto de `.container`.

**[Gabarito]** Letra C

**[Chave de Resposta]**
- **Alternativa A:** (Incorreta). Com `box-sizing: content-box`, os 300px referem-se apenas ao conteúdo. Padding (20px × 2 = 40px), border (5px × 2 = 10px) e margin (10px × 2 = 20px) são somados, totalizando 370px — não 300px. Além disso, o seletor `>` (filho direto) do Trecho 3 não alcança parágrafos aninhados dentro de `.details`.
- **Alternativa B:** (Incorreta). O cálculo de 350px omite a border (10px) e a margin (20px). A interpretação do seletor também está incorreta pelo mesmo motivo da alternativa A.
- **Alternativa C:** (Correta). Alternativa correta. Com `content-box`, a largura total horizontal é: 300 (width) + 40 (padding) + 10 (border) + 20 (margin) = 370px. O seletor `.card > p` usa o combinador filho direto (`>`), selecionando apenas `<p>` imediatamente filhos de `.card` — o `<p>` dentro de `.details` não é atingido. Para selecionar todos os descendentes, o correto seria `.card p` (sem `>`). Como aprofundamento: a diferença entre `content-box` e `border-box` é fundamental no design de componentes — o `border-box` incluiria padding e border dentro dos 300px, simplificando cálculos de layout.
- **Alternativa D:** (Incorreta). O cálculo de 350px está incorreto. Adicionalmente, o Trecho 2 usa seletor descendente (`.container .card .title`), que funciona em qualquer nível de aninhamento — não exige que `.title` seja filho direto de `.card`.
- **Alternativa E:** (Incorreta). Embora os 370px estejam corretos, a interpretação do Trecho 2 está equivocada: o seletor descendente não exige relação de filho direto entre `.container` e `.title` — qualquer nível de aninhamento é válido.

---

## Modelo DISC — Discursiva

**Disciplina/Tema:** Desenvolvimento Web — JavaScript assíncrono e Fetch API
**Modelo:** DISC
**Nível:** Avançado
**Pontuação:** 2,0 pontos

**[Texto-base]**
Uma desenvolvedora júnior escreveu a função abaixo para listar os eventos cadastrados
em uma API local (JSON Server). Ao abrir a página, a lista fica vazia e o console exibe
`TypeError: resposta.json is not a function`.

```javascript
async function carregarEventos() {
  const lista = document.getElementById("lista");
  const resposta = fetch("http://localhost:3000/eventos");
  const eventos = await resposta.json();
  eventos.forEach((e) => {
    lista.innerHTML += `<li>${e.nome}</li>`;
  });
}

carregarEventos();
```

Durante a revisão, o tech lead pediu que a função também tratasse falhas da API, exibindo
na própria lista a mensagem "Falha ao carregar os eventos." quando a requisição falhar.

**[Enunciado]**
Com base no código e no cenário apresentados, responda aos itens a seguir, em até 10 linhas
para os itens a) e b).

a) **(0,6 ponto)** Explique a causa do erro exibido no console, indicando o tipo do valor
armazenado em `resposta` e o motivo de esse valor ter sido produzido.

b) **(0,6 ponto)** Suponha que o erro do item a) tenha sido corrigido e que o endereço
`/eventos` passe a responder com status 404. Explique por que a promessa devolvida por
`fetch` é resolvida nessa situação e indique a propriedade do objeto `Response` que permite
detectar a falha.

c) **(0,8 ponto)** Reescreva a função `carregarEventos` corrigindo o erro do item a), detectando
respostas com status de erro e tratando falhas de rede, de modo que a mensagem pedida pelo
tech lead seja exibida em `#lista` nesses casos.

**[Padrão de Resposta]**
- **Item a (0,6):** `fetch` é assíncrono e devolve uma `Promise` (de um objeto `Response`).
  Sem `await`, `resposta` guarda a própria `Promise`, que é um objeto sem o método `json`;
  por isso a chamada `resposta.json()` lança `TypeError`. A correção é usar
  `await fetch(...)`.
  - *Nota integral:* identifica que `resposta` contém uma `Promise` **e** relaciona a ausência
    de `await` ao erro de método inexistente.
  - *Nota parcial (0,3):* aponta a falta de `await` sem explicar o tipo do valor ou o motivo
    da mensagem de erro.
  - *Não pontua:* atribui o erro à URL, ao servidor ou ao formato do JSON.
- **Item b (0,6):** a promessa de `fetch` é rejeitada em falhas de rede (servidor
  inacessível, bloqueio de CORS, conexão interrompida) ou em cancelamento; uma resposta HTTP com status de erro ainda é uma
  resposta recebida, então a promessa é resolvida. A falha é detectada por `response.ok`
  (falso fora da faixa 200–299) ou por `response.status`.
  - *Nota integral:* distingue falha de rede de status HTTP de erro **e** cita `ok` ou `status`.
  - *Nota parcial (0,3):* cita `ok`/`status` sem explicar por que a promessa é resolvida, ou
    explica a distinção sem indicar a propriedade.
  - *Não pontua:* afirma que o 404 rejeita a promessa ou que o erro é capturado pelo `catch`
    sem verificação adicional.
- **Item c (0,8):** resposta de referência (aceitar equivalentes, como `.then/.catch`):

  ```javascript
  async function carregarEventos() {
    const lista = document.getElementById("lista");
    try {
      const resposta = await fetch("http://localhost:3000/eventos");
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const eventos = await resposta.json();
      lista.innerHTML = "";
      eventos.forEach((e) => {
        lista.innerHTML += `<li>${e.nome}</li>`;
      });
    } catch (erro) {
      lista.innerHTML = "<li>Falha ao carregar os eventos.</li>";
    }
  }
  ```

  - *Nota integral:* `await` em `fetch` e em `json()`, verificação de `ok`/`status` que
    desvia para o tratamento de erro **e** `try/catch` (ou `.catch`) que exibe a mensagem em
    `#lista`.
  - *Nota parcial (0,4):* corrige o `await` e trata falha de rede, mas deixa de verificar o
    status (ou o contrário).
  - *Não pontua:* exibe a mensagem com `alert`/`console.log` em vez de `#lista`, ou mantém
    `fetch` sem `await`.
