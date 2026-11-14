# Do Campo à Mesa — Relatório técnico

**Desenvolvimento Web e para a Cloud · Mestrado em Engenharia Informática · ESTG–IPVC · 2026/2027**


## 1. Introdução

O projeto «Do Campo à Mesa» consiste no desenvolvimento de um mercado digital que aproxima pequenos produtores agrícolas de compradores particulares e de entidades de restauração. O objetivo é disponibilizar, numa única aplicação web, um catálogo de produtos locais, uma área de encomendas e um mecanismo de leilões em tempo real para lotes sazonais ou excedentes de produção.

O trabalho foi realizado no âmbito da unidade curricular de Desenvolvimento Web e para a Cloud, do Mestrado em Engenharia Informática, e combina os conteúdos de frontend responsivo, Single Page Application (SPA), API REST, persistência NoSQL, autenticação, comunicação em tempo real e deployment em serviços Cloud geridos.

Foram considerados quatro perfis: visitante, comprador, produtor e administrador. O visitante pode consultar produtos, produtores e leilões; o comprador pode criar encomendas, avaliar após a entrega e licitar; o produtor gere produtos, a sua exploração, encomendas e leilões; o administrador aprova produtores e modera conteúdos. Estas permissões são verificadas no servidor, e não apenas escondidas na interface.

A solução foi publicada com frontend no Azure Static Web Apps, backend no Render, base de dados no MongoDB Atlas e fotografias no Azure Blob Storage. O projeto foi validado com testes locais e verificações em ambiente público, incluindo chamadas à API via Swagger, navegação no catálogo, imagens armazenadas na Cloud e licitações entre utilizadores.

## 2. Arquitetura

A arquitetura segue uma separação entre apresentação, lógica aplicacional, comunicação em tempo real e persistência. O browser executa uma SPA React compilada pelo Vite; os pedidos HTTP são enviados por HTTPS à API Express. O mesmo processo Node.js disponibiliza também o servidor Socket.io, ligado ao servidor HTTP partilhado. A API utiliza Mongoose para comunicar com o MongoDB Atlas e o SDK Azure para guardar imagens em Blob Storage.

```mermaid
flowchart TD
    GH[GitHub / CI-CD] --> SWA[React e Vite / Azure Static Web Apps]
    GH --> API[Express / Render]
    SWA -->|HTTPS / JSON e JWT| API
    SWA <-->|Socket.io seguro| RT[Servidor Socket.io / Render]
    API --- RT
    API -->|Mongoose / TLS| DB[(MongoDB Atlas)]
    API -->|HTTPS / upload| BLOB[(Azure Blob Storage)]
```

*Figura 1 — Diagrama de componentes e dos principais canais de comunicação da solução publicada.*

### 2.1. Fluxos de comunicação

Nos pedidos REST, o cliente envia e recebe JSON através de endpoints sob o prefixo /api. Os pedidos protegidos transportam o token JWT no cabeçalho Authorization: Bearer. O carregamento de fotografias utiliza multipart/form-data; o ficheiro é enviado ao backend, que o coloca no Blob Storage e persiste apenas o respetivo URL no documento MongoDB do produto.

Nos leilões, a SPA estabelece uma ligação Socket.io autenticada e entra numa sala identificada pelo leilão. O servidor transmite atualizações de licitações e presença à sala; eventos relativos a encomendas e ao resultado de leilões são também enviados para salas pessoais de utilizador. O serviço de leilões verifica periodicamente a abertura e o fim dos eventos com base nas datas armazenadas na base de dados.

### 2.2. Separação de responsabilidades

A API concentra regras de negócio e validações, evitando decisões sensíveis no navegador. A base de dados assegura persistência, índices e transações. O armazenamento de objetos evita dependência do sistema de ficheiros efémero do serviço de alojamento. O GitHub funciona como repositório de código e base para os pipelines de publicação automática.

## 3. Frontend e SPA

### 3.1. Tecnologias e componentes

Foi escolhido React 18 com Vite por permitir organizar a interface em componentes reutilizáveis, atualizar seletivamente o ecrã sem recarregar a página e manter uma estrutura de desenvolvimento simples para um projeto individual. O Vite oferece um servidor de desenvolvimento rápido e gera a versão estática distribuída pelo Azure Static Web Apps. A interface utiliza Bootstrap 5 e SASS, com variáveis de tema e mixins próprios.

A aplicação inclui componentes como Navbar, CartaoProduto, RotaProtegida, EstadoEncomenda, Notificacoes e elementos de gestão de produtor. As páginas contemplam catálogo, detalhe de produto, perfil público de produtor, carrinho, encomendas, leilões, sala do leilão e painéis específicos de produtor e administrador.

### 3.2. Navegação e gestão de estado

O React Router gere a navegação pelo lado do cliente, incluindo rotas públicas (/ e /produtos/:id), rotas autenticadas (/leiloes/:id) e áreas protegidas por papel (/carrinho, /produtor e /admin). A componente RotaProtegida limita a navegação, mas a autorização efetiva permanece no backend.

O AuthContext centraliza a sessão e os dados do utilizador; o CarrinhoContext gere os produtos selecionados e a sua persistência local. O SocketContext disponibiliza a ligação partilhada ao servidor de eventos e o hook useLeilao mantém estado do leilão, histórico, presença, contagem decrescente e resultado. Para a interface foram utilizados estados locais e efeitos React, sem necessidade de uma biblioteca global adicional. O cliente HTTP concentra a construção do endereço base e o envio do JWT.

### 3.3. Mobile First e responsividade

A estratégia Mobile First parte de estilos adaptados a ecrãs pequenos e acrescenta regras de composição com media queries de min-width. O projeto define três breakpoints em SASS: 768 px (md), 1024 px (lg) e 1280 px (xl). O mixin a-partir-de() e as classes responsivas do Bootstrap são utilizados para ajustar a grelha do catálogo, a disposição de cartões, painéis e elementos de navegação. A paleta visual é parametrizada em SASS com verde, terracota e tons neutros, permitindo consistência entre páginas.

A publicação estática inclui uma regra navigationFallback para index.html, necessária para que uma ligação direta ou o refresh de uma rota interna seja entregue ao React Router, em vez de originar um erro 404 do alojamento.

## 4. API REST e documentação

O backend foi implementado em Node.js 22 e Express 4. Os recursos principais estão organizados em routers por domínio, com prefixos /api/auth, /api/products, /api/producers, /api/orders, /api/auctions, /api/reviews e /api/admin. O endpoint /api/health suporta verificações de disponibilidade. O processamento de erros é centralizado para produzir respostas JSON consistentes.

| Recurso / exemplos | Operações principais | Objetivo |
| --- | --- | --- |
| /auth | POST registo e login; GET /eu | Conta, autenticação e identificação da sessão |
| /products | GET pesquisa/detalhe; POST, PUT, DELETE; POST imagem | Catálogo, filtros, moderação e fotografias |
| /producers | GET lista/detalhe; PATCH /me | Perfil e exploração do produtor |
| /orders | POST; GET lista/detalhe; PATCH estado | Compra, stock e ciclo de encomendas |
| /auctions | GET lista/detalhe/histórico; POST | Criação e consulta de leilões |
| /reviews | GET; POST; POST denúncia | Avaliações e denúncias |
| /admin | GET estatísticas e pendentes; PATCH validação/moderação | Operações de administração |

A API utiliza os métodos HTTP de acordo com a operação: GET para consulta, POST para criação, PUT para atualização completa de produtos, PATCH para alterações parciais e DELETE para remoção. Foram utilizadas respostas 200 (sucesso), 201 (recurso criado), 204 (remoção sem corpo), 400 (pedido inválido), 401 (não autenticado), 403 (sem permissão), 404 (não encontrado) e 409 (conflito de negócio, incluindo stock insuficiente ou mudança de estado inválida).

### 4.1. Documentação OpenAPI e validação

A especificação OpenAPI 3.0 é disponibilizada pela biblioteca Swagger UI em https://dcm-api-eduarda.onrender.com/api-docs. O campo servers foi configurado com a base /api do serviço publicado; assim, uma operação descrita como /products é executada sobre /api/products. Esta correção foi necessária após os primeiros testes, que apontaram para localhost e, posteriormente, para um caminho sem o prefixo /api.

No ambiente publicado, a operação GET /api/products foi executada no Swagger com resposta HTTP 200 e dados provenientes da base de dados. A operação POST /api/products sem token devolveu 401, comportamento esperado numa rota protegida. Estas verificações demonstram acessibilidade pública da documentação e controlo de autenticação, sem substituir testes exaustivos de todas as rotas.

## 5. Modelo de dados

A persistência utiliza MongoDB Atlas e modelos Mongoose. Foram identificadas seis coleções principais: users, products, orders, auctions, bids e reviews. O desenho combina referências ObjectId (linking) para entidades que evoluem de forma independente com subdocumentos embebidos para informação pequena e normalmente consultada em conjunto.

| Coleção | Estrutura relevante | Opção de modelação |
| --- | --- | --- |
| users | Identidade, papel, dados da exploração e aprovação | Dados específicos de produtor embebidos no utilizador |
| products | Produtor, categoria, preço, stock, épocas, imagemUrl | Referência ObjectId ao produtor |
| orders | Comprador, produtor, linhas, entrega, estado | Linhas e dados de entrega embebidos; referências às pessoas |
| auctions | Produtor, produto, datas, licitação atual, estado | Licitação atual embebida; referências a utilizadores/produto |
| bids | Leilão, comprador, valor e data | Histórico separado do documento de leilão |
| reviews | Autor, produtor, produto, encomenda, classificação | Coleção própria com referências ObjectId |

### 5.1. Embedding versus linking

Nas encomendas, as linhas são embebidas porque representam um conjunto limitado, consultado juntamente com a compra. Conservam nome, preço unitário e quantidade registados no momento da encomenda, mesmo que o catálogo seja atualizado posteriormente. Os dados de entrega também são mantidos no mesmo documento.

Nos leilões, a licitacaoAtual está embebida em auctions, permitindo comparar e atualizar o valor vigente numa operação atómica sobre um único documento. Em contrapartida, o histórico de propostas é guardado separadamente em bids: esta separação evita crescimento ilimitado do documento do leilão e permite consultas ordenadas das últimas licitações.

As avaliações foram colocadas na coleção reviews, com referências ObjectId a autor, produtor e, quando aplicável, produto e encomenda. A escolha permite consultar avaliações por produtor ou produto, moderá-las individualmente e evitar expandir continuamente documentos de users/products. A avaliação só é aceite para uma encomenda do próprio comprador no estado entregue; existe ainda proteção de duplicados por índice único parcial.

### 5.2. Índices e pesquisas

Os índices declarados no código incluem email único em users; em products, índices compostos {produtor: 1, createdAt: -1} e {categoria: 1, preco: 1}; em auctions, índices para produtor, estado e terminaEm; em bids, índice sobre leilao; e em orders, índices sobre comprador e produtor. Em reviews, o índice composto único (autor, encomenda, produto), limitado a documentos com encomenda do tipo ObjectId, impede duplicações por alvo e encomenda. Esta descrição corresponde às definições Mongoose identificadas no código, não a medições de desempenho dos índices no Atlas.

O catálogo aplica pesquisa textual com expressões regulares (RegExp com opção i) sobre nome/descrição e uma consulta auxiliar a produtores; utiliza $lte para filtrar precoMax e $in para categorias ou épocas pertinentes. A compra usa stock: {$gte: quantidade} para reservar existências sem permitir valores negativos. Os leilões usam iniciaEm: {$lte: agora} e terminaEm: {$lt: agora} na seleção de itens a abrir/encerrar. São exemplos concretos de consultas exigidas pelo enunciado.

```javascript
Exemplos: { preco: { $lte: 10 } }  ·  { stock: { $gte: 2 } }  ·  { terminaEm: { $lt: new Date() } }
```

## 6. Segurança

A autenticação é baseada em JSON Web Tokens (JWT). Após um login válido, a API assina um token com identificador, nome e papel do utilizador; a expiração configurada é de duas horas. O cliente inclui o token nas chamadas protegidas através do cabeçalho Authorization. O middleware valida assinatura e expiração, confirma a existência atual do utilizador na base de dados e verifica o seu papel.

O controlo de acesso distingue comprador, produtor e administrador. A criação de leilões e a gestão de produtos exigem o papel produtor, estando também dependentes da aprovação administrativa; a submissão de licitações exige comprador; as rotas /api/admin exigem administrador. São devolvidos 401 para token ausente/inválido ou sessão não autorizada e 403 para papel insuficiente.

No registo, o backend valida email, nome e password, restringe a criação pública aos papéis comprador/produtor e utiliza bcryptjs com fator de custo 12 para armazenar apenas passwordHash. O modelo exclui esse campo das consultas normais e disponibiliza uma representação pública sem o hash. O handshake Socket.io valida o JWT, consulta o utilizador e impede ligações não autorizadas.

O frontend e a API são servidos por HTTPS; para Socket.io, a ligação segura utiliza o mesmo domínio HTTPS e o transporte WebSocket quando disponível. A configuração CLIENT_URL limita a origem aceite pelas políticas CORS. No Render, MONGODB_URI, JWT_SECRET e STORAGE_CONN são variáveis de ambiente e não são colocadas no repositório; o frontend contém apenas VITE_API_URL, variável pública de compilação.

Estas medidas reduzem riscos comuns, mas não equivalem a uma auditoria de segurança formal. A persistência de sessão em localStorage, por exemplo, exige atenção à prevenção de XSS; numa evolução futura poderá ser considerada uma estratégia de cookies HttpOnly/Secure, complementada por políticas de cabeçalhos, rate limiting e testes de segurança.

## 7. Tempo real e consistência dos leilões

### 7.1. Salas, eventos e presença

O Socket.io usa o mesmo servidor HTTP do Express. Depois de autenticar o JWT no handshake, cada ligação integra a sala pessoal user:<id>; administradores juntam-se a admin:leiloes. Quando abre uma sala de leilão, o cliente emite entrar com o identificador; o servidor consulta o leilão e as últimas 20 propostas, executa socket.join(leilao:<id>) e devolve o evento estado com a hora atual do servidor.

Os eventos principais são estado, presenca, nova-licitacao, recusada, aberto e terminado. As alterações das encomendas geram encomenda-atualizada para o comprador; o vencedor de um leilão recebe leilao-ganho e o produtor recebe leilao-terminado/nova-encomenda. O contador da interface considera o desvio entre relógio do cliente e hora comunicada pelo servidor, reduzindo divergências visuais entre participantes.

### 7.2. Validação e simultaneidade

A regra central é que duas ofertas concorrentes não podem ambas ser aceites com base no mesmo preço anterior. O servidor não confia no valor exibido pelo browser: valida identidade do comprador, formato monetário, leilão ativo, intervalo temporal e incremento mínimo. A operação findOneAndUpdate aplica, no mesmo filtro, as condições estado=ativo, iniciaEm<=agora, terminaEm>agora e licitacaoAtual.valor<=valor-incremento. Assim, uma proposta só é aplicada se continuar válida no instante da atualização.

```mermaid
flowchart LR
    A[Dois compradores licitam] --> B[Validação e filtro atómico]
    B --> C[(findOneAndUpdate / MongoDB)]
    C --> D[Uma proposta aceite]
    C --> E[Outra proposta rejeitada por mínimo desatualizado]
```

*Figura 2 — Atualização condicional do preço e rejeição de uma oferta concorrente já desatualizada.*

A atualização da licitação atual, o incremento do contador e a criação do registo em bids decorrem na mesma transação MongoDB. O broadcast nova-licitacao é realizado apenas após o sucesso da operação. Em testes com duas propostas simultâneas, só uma foi aceite; também foram exercitados cenários de acessos não autorizados e estados de encomenda. Esta evidência valida o cenário testado, sem constituir uma prova formal para qualquer volume de concorrência.

### 7.3. Abertura, encerramento e consistência

Um ciclo executado no servidor verifica de dois em dois segundos os leilões agendados que devem abrir e os leilões cujo prazo terminou. A alteração do estado para terminado ocorre numa transação, que cria uma encomenda confirmada para o vencedor e guarda a referência no leilão, quando existe uma licitação vencedora. A condição de atualização evita repetir o encerramento de um leilão já terminado. Os eventos de resultado são enviados após o commit da transação.

Em produção, foi observado que o backend regista o estado final e o vencedor e envia notificações Socket.io sem atualização manual; no entanto, a página de detalhe pode permanecer visualmente em «A aguardar encerramento» até ocorrer refresh. Por essa razão, a atualização visual instantânea do estado final é registada como limitação conhecida, distinta da persistência e da notificação do resultado.

## 8. Deployment na Cloud

A solução final utiliza quatro serviços Cloud, cada um com uma responsabilidade isolada. A arquitetura evoluiu relativamente à proposta inicial de alojar toda a aplicação no Azure: a API foi publicada com sucesso no Render após dificuldades de arranque no Azure App Service F1. O frontend permaneceu no Azure Static Web Apps e as imagens no Azure Blob Storage; a base de dados está no MongoDB Atlas.

| Serviço | Responsabilidade e modelo | Custos/limites |
| --- | --- | --- |
| Azure Static Web Apps · Free | Hospedagem global da SPA; PaaS de frontend estático | 0 € na oferta Free, sujeito a quotas |
| Render Web Service · Free | Node.js, Express e Socket.io; PaaS | 0 € no plano Free, sujeito a limites de uso; suspensão por inatividade |
| MongoDB Atlas | Base de dados gerida; DBaaS (modalidade BaaS/PaaS gerida) | 0 € se utilizado cluster Free/M0, dentro dos limites |
| Azure Blob Storage · Standard/LRS | Armazenamento de objetos; serviço gerido/BaaS de storage | Preço variável por capacidade, operações e tráfego |

### 8.1. Publicação e configuração

O repositório GitHub usa a branch main. Um workflow GitHub Actions compila o frontend (npm run build, saída dist) e publica os ficheiros no Static Web Apps; o backend é construído no Render a partir da subpasta api (npm install e npm start). A variável pública VITE_API_URL aponta para a origem do Render; a variável CLIENT_URL limita CORS ao domínio do Azure. O ficheiro staticwebapp.config.json define o fallback das rotas da SPA para index.html.

No Render, as configurações sensíveis são introduzidas em Environment; o serviço liga-se ao Atlas através de endereços autorizados na IP Access List. As imagens são persistidas no contentor produtos da conta Azure Storage, em vez de serem guardadas permanentemente no disco do Render, que é efémero no plano gratuito.

### 8.2. Endereços e disponibilidade

SPA: https://blue-moss-0a0dea503.4.azurestaticapps.net

API/health: https://dcm-api-eduarda.onrender.com/api/health

Swagger UI: https://dcm-api-eduarda.onrender.com/api-docs

Na publicação, o Swagger devolveu 200 em GET /api/products e 401 esperado num POST protegido sem token. O catálogo carregou produtos e fotografias reais e foram observadas licitações e notificações em tempo real entre utilizadores.

### 8.3. Estimativa de custos e limitações

Para uma demonstração de baixo tráfego, o frontend Free e o backend Render Free têm custo base de alojamento de 0 €/mês, enquanto o Atlas poderá manter custo base nulo se permanecer no tier gratuito. O Blob Storage é faturado por utilização: a ordem de grandeza de armazenamento para menos de 1 GB de imagens tende a ser reduzida, mas o custo real depende da região, classe, operações, volume transferido e regras da subscrição. Não foi efetuada medição de faturação que permita indicar um custo total exato.

O Render Free pode suspender o serviço após aproximadamente 15 minutos sem pedidos HTTP nem mensagens WebSocket recebidas, retomando-o quando houver novo tráfego. Durante a suspensão, o processo de verificação periódica dos leilões não está ativo; no arranque seguinte, o backend volta a verificar leilões expirados. Esta característica distingue uma demonstração académica de uma solução com requisitos de disponibilidade contínua.

## 9. Dificuldades e trabalho futuro

### 9.1. Principais dificuldades

Deployment da API. A primeira tentativa no Azure App Service Linux F1 completou o build com Microsoft Oryx, mas o contentor terminou repetidamente durante o arranque. Foram verificados logs, comando npm start, variáveis, quotas do plano e conectividade. Para reduzir o tempo de resolução, a API foi posteriormente publicada no Render, onde o log identificou diretamente uma MongooseServerSelectionError causada por falha de acesso ao Atlas. A autorização dos IPs de saída do novo serviço resolveu a ligação.

Documentação e rotas. A Swagger UI esteve inicialmente configurada para localhost e, depois, para a origem publicada sem o prefixo /api. A configuração do bloco servers foi corrigida e a operação GET /api/products passou a responder com sucesso. Na SPA alojada no Azure, um refresh numa rota interna originou 404 até à configuração de navigationFallback.

Eventos e sincronização visual. Os clientes recebem novas licitações e notificações sem refresh, mas em algumas circunstâncias a apresentação do estado final do leilão só se atualiza depois de recarregar a página. Trata-se de uma limitação de sincronização da interface, mantida identificada para trabalho futuro.

### 9.2. Melhorias propostas

Como evolução futura, destacam-se: sincronização do estado final via reconexão e refetch do leilão; mecanismo de processamento agendado independente do ciclo de vida da instância gratuita; testes de carga e recuperação de falhas; monitorização e alertas; testes automatizados end-to-end no ambiente publicado; e revisão de segurança, acessibilidade e experiência em dispositivos móveis. A eventual passagem para um serviço com disponibilidade contínua deverá ser avaliada em função de custos e necessidades reais.

## 10. Declaração de uso de ferramentas

O projeto foi desenvolvido com tecnologias e bibliotecas de código aberto apropriadas a cada camada: React, React Router, Vite, Bootstrap, SASS e socket.io-client no frontend; Node.js, Express, Mongoose, Socket.io, bcryptjs, jsonwebtoken, Multer, swagger-ui-express e @azure/storage-blob no backend. Foram utilizados Git/GitHub e GitHub Actions para controlo de versões e publicação, Swagger UI para explorar os contratos HTTP, MongoDB Atlas para persistência e os portais Azure e Render para configuração e diagnóstico.

Foi também utilizado o assistente ChatGPT (OpenAI) como apoio ao planeamento da implementação, explicação de conceitos, análise de mensagens de erro, configuração Cloud, preparação de testes e estruturação/revisão deste relatório. As sugestões foram integradas de forma crítica e sujeitas a verificação no código e na execução da aplicação. O recurso a IA não substitui a autoria individual, a compreensão técnica e a responsabilidade pelo trabalho entregue.

### Fontes técnicas consultadas

Enunciado e Guia de Implementação «Do Campo à Mesa», unidade curricular de Desenvolvimento Web e para a Cloud, ESTG–IPVC (2026/2027).

Microsoft Learn — Azure Static Web Apps: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration

Microsoft Learn — Custos de Azure Blob Storage: https://learn.microsoft.com/en-us/azure/storage/common/storage-plan-manage-costs

Render — Deploy for Free: https://render.com/docs/free

MongoDB Atlas — Pricing e tier Free: https://www.mongodb.com/pricing
