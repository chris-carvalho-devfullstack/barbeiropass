# AI Project Context — BarbeiroPass

> Documento de referência para ChatGPT, Gemini, Claude, GitHub Copilot e outras IAs que trabalharem neste projeto.
>
> **Objetivo:** fornecer contexto arquitetural e regras de trabalho para que uma IA entenda o projeto antes de criar ou modificar código, evitando duplicação, inconsistências e alterações desnecessárias.

---

## 1. Objetivo deste arquivo

Este arquivo define o fluxo recomendado para usar ferramentas de IA no desenvolvimento do **BarbeiroPass**.

As IAs devem tratar o projeto existente como a fonte principal da verdade.

Antes de implementar uma feature:

1. entender a arquitetura existente;
2. consultar o mapa gerado pelo Graphify;
3. localizar componentes, serviços, APIs, tipos e fluxos relacionados;
4. verificar se já existe uma solução reutilizável;
5. identificar impactos e dependências;
6. propor um plano;
7. somente depois implementar.

**Não criar uma arquitetura paralela sem antes verificar a arquitetura existente.**

---

# 2. Regra principal

## Primeiro entender. Depois planejar. Só então implementar.

Uma solicitação de feature não deve ser interpretada automaticamente como autorização para criar novos arquivos.

Antes de criar:

- componente;
- hook;
- service;
- API route;
- contexto;
- utilitário;
- tipo;
- tabela;
- função;
- middleware;
- integração;
- sistema de cache;

verificar se já existe algo no projeto que possa ser reutilizado ou estendido.

### Princípio

> **Reuse before create. Extend before duplicate.**

Se uma solução existente atende parcialmente ao requisito, avaliar primeiro a possibilidade de extensão.

---

# 3. Graphify

O projeto utiliza **Graphify** para construir um mapa da arquitetura e das relações entre os elementos do código.

O Graphify não substitui a leitura do código.

Ele deve ser tratado como um **mapa arquitetural**.

### Analogia

- `graph.json` = mapa estruturado da cidade;
- `GRAPH_REPORT.md` = visão resumida da cidade;
- código-fonte = ruas e prédios reais.

O mapa ajuda a encontrar o caminho, mas decisões de implementação devem ser confirmadas no código-fonte.

---

# 4. Arquivos gerados pelo Graphify

Normalmente são produzidos arquivos como:

```text
graph.json
GRAPH_REPORT.md
graph.html
manifest.json
```

Dependendo da configuração/workflow, outros arquivos auxiliares podem existir.

## graph.json

É o principal artefato estruturado do grafo.

Pode conter informações sobre:

- arquivos;
- módulos;
- funções;
- componentes;
- classes;
- imports;
- chamadas;
- dependências;
- relacionamentos;
- comunidades;
- conexões entre partes do sistema.

É especialmente útil para uma IA que precisa analisar relações arquiteturais.

### Importante

`graph.json` não contém necessariamente todo o conteúdo dos arquivos.

Portanto:

> **Graphify identifica onde e como as coisas se relacionam; o código-fonte confirma como elas realmente funcionam.**

---

## GRAPH_REPORT.md

É uma representação mais amigável da arquitetura.

Deve ser usado para obter rapidamente:

- visão geral;
- comunidades;
- áreas funcionais;
- nós importantes;
- conexões relevantes;
- possíveis pontos centrais;
- perguntas arquiteturais;
- diagnósticos do grafo.

É especialmente útil para a primeira etapa de análise.

---

## graph.html

É uma visualização navegável do grafo.

Pode ser útil para análise visual das relações entre partes do projeto.

Não deve ser tratado como substituto do código-fonte ou do `graph.json`.

---

# 5. Estado atual conhecido do grafo

No momento da documentação desta instrução, uma execução do Graphify produziu aproximadamente:

- **1.027 nós**
- **3.379 arestas**
- **42 comunidades**

O grafo identificou áreas como:

- Client Management Components;
- Appointments and Stations;
- Authentication and Appearance;
- Supabase Queue APIs;
- Dashboard and Shared UI;
- Public Data APIs;
- Queue and POS Workflows.

Esses números são históricos e podem mudar conforme o projeto evolui.

**Sempre considere o grafo mais recente como referência.**

---

# 6. Diagnósticos do Graphify

O Graphify pode apresentar diagnósticos como:

- dangling endpoint edges;
- self-loop;
- collapsed same-endpoint edges;
- god nodes;
- conexões inesperadas;
- arquivos não analisados;
- linguagens sem parser disponível.

Esses resultados **não devem ser automaticamente interpretados como bugs do sistema**.

Por exemplo:

```text
dangling endpoint
```

pode significar apenas que o grafo possui uma referência que não conseguiu ser resolvida completamente.

Da mesma forma:

```text
god node
```

indica um elemento muito conectado no grafo, mas não significa automaticamente que o código esteja errado.

A IA deve distinguir:

1. problema do código;
2. característica arquitetural;
3. limitação da análise;
4. limitação do parser;
5. artefato do processo de geração do grafo.

---

# 7. Quando atualizar o Graphify

O grafo deve ser atualizado principalmente depois de mudanças estruturais significativas.

Exemplos:

- criação de novos módulos;
- criação de novas APIs;
- mudança de arquitetura;
- criação de novos serviços;
- alteração importante no fluxo de autenticação;
- alteração do fluxo de filas;
- alteração do acesso ao Supabase;
- criação de novos domínios;
- refatorações grandes;
- alteração de middleware;
- mudança importante de dependências.

Não é necessário reconstruir o grafo depois de toda pequena alteração visual.

---

# 8. Como atualizar o grafo

O workflow atualmente validado para este projeto é utilizar o comando:

```text
/graphify
```

dentro do **GitHub Copilot Chat**, após abrir o projeto no VS Code.

Esse workflow foi configurado pelo:

```text
graphify vscode install
```

e criou:

```text
.github/copilot-instructions.md
```

Além disso, o Graphify pode ser utilizado diretamente pela CLI conforme os comandos disponíveis na versão instalada.

Antes de assumir que determinado comando existe, consultar:

```powershell
graphify --help
```

ou:

```powershell
graphify <comando> --help
```

**Não assumir que uma versão futura do Graphify possui exatamente os mesmos comandos da versão atual.**

---

# 9. Segurança e arquivos sensíveis

O Graphify pode ignorar arquivos considerados sensíveis.

Por exemplo:

```text
.npmrc
```

pode ser identificado como arquivo sensível dependendo do conteúdo/configuração.

Nunca solicitar a uma IA que exponha:

- tokens;
- API keys;
- passwords;
- secrets;
- credenciais;
- service-role keys;
- certificados;
- arquivos `.env`;
- dados privados de usuários.

Quando um arquivo sensível for necessário para entender uma integração, preferir descrever sua estrutura sem revelar o segredo.

---

# 10. Graphify e Git

Se o projeto estiver configurado para ignorar os artefatos do Graphify, não remover essa configuração sem motivo.

Exemplo:

```gitignore
# graph analysis reports
graphify-out/
```

Nesse caso, os artefatos de análise podem permanecer localmente sem aparecer no `git status`.

Antes de executar comandos como:

```powershell
git add .
```

verificar:

```powershell
git status --short
```

Isso é especialmente importante porque a execução do Graphify pode criar arquivos auxiliares, enquanto outras alterações do projeto podem existir simultaneamente.

---

# 11. Workflow recomendado para desenvolver uma feature com IA

## Etapa 1 — Atualizar o mapa

Se houve alterações estruturais recentes:

```text
/graphify
```

---

## Etapa 2 — Ler o relatório

Consultar:

```text
GRAPH_REPORT.md
```

Primeiro procurar:

- comunidade relacionada;
- componentes centrais;
- APIs;
- serviços;
- tipos;
- entidades;
- conexões;
- possíveis pontos de entrada.

---

## Etapa 3 — Consultar o graph.json

Usar:

```text
graph.json
```

quando for necessário investigar relações específicas.

Perguntas úteis:

- Quem chama esta função?
- Quais arquivos dependem deste serviço?
- Qual API utiliza este componente?
- Quais componentes dependem deste contexto?
- Quais partes podem ser afetadas por esta alteração?
- Existe outro fluxo que já implementa algo semelhante?

---

## Etapa 4 — Localizar o código real

Depois de identificar os elementos relevantes no grafo, abrir os arquivos correspondentes.

A IA deve confirmar no código:

- comportamento;
- tipos;
- parâmetros;
- tratamento de erros;
- autenticação;
- autorização;
- acesso ao banco;
- validação;
- cache;
- side effects;
- dependências.

---

# 12. Análise de impacto

Antes de implementar uma feature, identificar:

### Front-end

- página;
- layout;
- componente;
- hook;
- contexto;
- estado;
- formulário;
- validação;
- loading;
- error state.

### Back-end

- route handler;
- service;
- action;
- repository;
- integração;
- autenticação;
- autorização;
- validação.

### Dados

- tabelas;
- views;
- functions;
- triggers;
- migrations;
- relacionamentos;
- RLS;
- tipos.

### Infraestrutura

- middleware;
- Supabase;
- Cloudflare;
- cache;
- variáveis de ambiente;
- storage;
- filas;
- webhooks.

---

# 13. Verificar efeitos colaterais

Toda alteração relevante deve responder:

1. Quem chama o código que será alterado?
2. Quem depende dele?
3. Existe outro fluxo que reutiliza essa função?
4. A alteração muda algum contrato?
5. Há impacto em autenticação?
6. Há impacto em autorização?
7. Há impacto em RLS?
8. Há impacto em cache?
9. Há impacto em performance?
10. Há impacto em outros tenants?
11. Há impacto no fluxo público?
12. Há impacto no dashboard?
13. Há impacto em APIs existentes?

---

# 14. God Nodes

O relatório do Graphify pode indicar elementos com muitas conexões.

Exemplos encontrados anteriormente:

```text
cn()
createClient()
next
Button
react
```

Esses elementos devem receber atenção especial durante refatorações.

Uma alteração em um nó altamente conectado pode afetar muitas partes do projeto.

Porém:

> **Alta conectividade não significa automaticamente que o elemento deve ser refatorado.**

A IA deve primeiro entender por que o elemento possui tantas conexões.

---

# 15. Não confiar cegamente no grafo

O grafo pode:

- não identificar uma relação;
- identificar uma relação incorretamente;
- não interpretar completamente código dinâmico;
- não analisar determinadas linguagens;
- depender de parsers instalados;
- apresentar referências sem endpoint;
- agrupar comunidades de maneira imperfeita.

Por isso:

> **Código-fonte > grafo quando houver conflito.**

Quando houver divergência, a IA deve informar:

```text
O Graphify indica X, mas a implementação atual do arquivo Y mostra Z.
```

E então seguir o código real.

---

# 16. Uso com ChatGPT

Para usar o projeto com ChatGPT, o ideal é fornecer:

```text
GRAPH_REPORT.md
graph.json
```

e, quando necessário, os arquivos de código relacionados à feature.

Para uma análise mais ampla, pode ser útil fornecer o projeto completo ou um conjunto maior de arquivos.

### Não enviar apenas o graph.json quando:

- a implementação precisa ser modificada;
- é necessário entender lógica de negócio;
- existem regras de validação;
- existem SQL/RLS;
- existe código dinâmico;
- é necessário alterar vários arquivos.

O `graph.json` ajuda a encontrar o caminho, mas não substitui o código.

---

# 17. Uso com Gemini

O mesmo princípio se aplica ao Gemini.

Fornecer:

```text
GRAPH_REPORT.md
graph.json
```

como contexto arquitetural.

Depois fornecer os arquivos relevantes.

Solicitar primeiro análise da arquitetura e impacto.

Só depois solicitar implementação.

---

# 18. Uso com Claude

O mesmo processo deve ser utilizado com Claude.

A IA deve receber:

1. contexto arquitetural;
2. feature desejada;
3. arquivos relevantes;
4. restrições técnicas;
5. comportamento esperado.

Claude, Gemini, ChatGPT e Copilot devem seguir a mesma lógica arquitetural.

Não considerar uma IA como autoridade sobre outra.

O código existente é a referência principal.

---

# 19. Prompt padrão para análise de feature

Usar este prompt como base:

```text
Vou implementar a seguinte feature:

[DESCREVER A FEATURE]

Use o GRAPH_REPORT.md e o graph.json como mapa arquitetural do projeto.

Antes de alterar qualquer código:

1. Identifique os módulos, páginas, componentes, APIs, services,
   hooks, contexts, tipos, tabelas e fluxos relacionados.
2. Identifique quais partes existentes podem ser reutilizadas.
3. Trace as principais dependências entre esses elementos.
4. Identifique quais arquivos provavelmente precisarão ser modificados.
5. Identifique possíveis novos arquivos que realmente sejam necessários.
6. Verifique possíveis impactos em autenticação, autorização, RLS,
   multi-tenancy, cache, performance e outros fluxos.
7. Verifique se existe implementação semelhante no projeto.
8. Identifique riscos e efeitos colaterais.
9. Diferencie o que foi confirmado pelo código do que é apenas inferência
   baseada no grafo.
10. Não altere código ainda.

Ao final, apresente um plano de implementação objetivo.
```

---

# 20. Prompt padrão para implementação

Depois que a arquitetura estiver entendida:

```text
Implemente a feature descrita anteriormente seguindo a arquitetura
existente do projeto.

Regras:

- Reutilize componentes, services, hooks e utilitários existentes quando possível.
- Não crie duplicações desnecessárias.
- Preserve os padrões atuais do projeto.
- Preserve os contratos existentes das APIs.
- Não altere funcionalidades não relacionadas.
- Não faça refatorações oportunistas.
- Não substitua uma biblioteca ou arquitetura existente sem necessidade.
- Mantenha tipagem forte.
- Preserve as regras de autenticação e autorização.
- Considere multi-tenancy.
- Considere RLS quando houver Supabase.
- Considere cache e invalidação quando aplicável.
- Mantenha tratamento de loading, erro e estados vazios.
- Mantenha consistência com o padrão visual existente.

Antes de finalizar:

1. Liste os arquivos modificados.
2. Explique o que mudou em cada um.
3. Liste novos arquivos criados.
4. Liste migrations ou alterações de banco necessárias.
5. Liste riscos ou pontos que precisam de teste.
6. Informe qualquer decisão arquitetural relevante.
```

---

# 21. Prompt para investigação sem alteração

Quando houver dúvida sobre uma parte do projeto:

```text
Analise esta parte do projeto sem modificar nenhum arquivo.

Use o graph.json e o GRAPH_REPORT.md para mapear as relações.

Quero saber:

- onde começa o fluxo;
- quais arquivos participam;
- quais funções são chamadas;
- quais dados são utilizados;
- quais APIs participam;
- quais tabelas são acessadas;
- quais regras de autenticação/autorização existem;
- quais componentes dependem disso;
- quais seriam os impactos de uma alteração.

Não proponha código ainda.
Primeiro reconstrua o fluxo atual.
```

---

# 22. Prompt para verificar se existe algo semelhante

Antes de criar uma nova solução:

```text
Antes de criar uma nova implementação para esta feature, procure no
projeto por funcionalidades semelhantes.

Use o graph.json, GRAPH_REPORT.md e o código-fonte.

Procure especialmente por:

- componentes equivalentes;
- services;
- hooks;
- actions;
- API routes;
- utilitários;
- validações;
- tipos;
- queries;
- padrões de acesso ao Supabase.

Informe:

1. o que já existe;
2. o que pode ser reutilizado;
3. o que pode ser estendido;
4. o que realmente precisa ser criado.

Não crie código ainda.
```

---

# 23. Prompt para análise de impacto

```text
Analise o impacto arquitetural desta alteração:

[ALTERAÇÃO]

Use o Graphify para localizar dependências.

Classifique os impactos em:

- Front-end
- Back-end
- Banco de dados
- Autenticação
- Autorização
- Multi-tenancy
- Supabase/RLS
- Cache
- Middleware
- Performance
- Testes
- Infraestrutura

Para cada item, informe se o impacto é:

- confirmado;
- provável;
- improvável;
- não identificado.

Não altere código.
```

---

# 24. Desenvolvimento em etapas

Para features maiores, preferir:

```text
1. Investigação
2. Mapeamento arquitetural
3. Análise de impacto
4. Plano
5. Implementação
6. Testes
7. Revisão
8. Atualização do Graphify
```

Evitar pedir:

```text
"Crie essa feature inteira"
```

sem fornecer contexto.

Preferir:

```text
"Analise primeiro."
```

e depois:

```text
"Implemente o plano aprovado."
```

Isso reduz alterações desnecessárias e facilita revisar o raciocínio da IA.

---

# 25. Regras para banco de dados

Antes de criar ou modificar tabelas:

1. verificar migrations existentes;
2. verificar tipos;
3. verificar relacionamentos;
4. verificar RLS;
5. verificar policies;
6. verificar funções;
7. verificar triggers;
8. verificar quem utiliza a tabela;
9. verificar se existe tabela equivalente.

Nunca criar uma nova tabela apenas porque parece conveniente sem verificar o modelo atual.

---

# 26. Regras para Supabase

Ao trabalhar com Supabase, sempre considerar:

- autenticação;
- `auth.uid()`;
- tenant;
- RLS;
- policies;
- service role;
- client server-side;
- client browser-side;
- migrations;
- tipos gerados;
- acesso público;
- APIs internas.

Nunca expor credenciais privadas.

Nunca assumir que uma API pública pode acessar diretamente dados protegidos.

---

# 27. Regras para APIs

Antes de criar uma nova API:

1. procurar routes existentes;
2. procurar actions/services relacionados;
3. verificar se existe endpoint equivalente;
4. verificar autenticação;
5. verificar autorização;
6. verificar validação;
7. verificar tratamento de erros;
8. verificar formato de resposta;
9. verificar consumidores existentes.

Manter consistência com os padrões já existentes.

---

# 28. Regras para componentes React

Antes de criar um componente:

1. procurar componentes semelhantes;
2. verificar componentes compartilhados;
3. verificar UI existente;
4. verificar props e tipos;
5. verificar padrões de loading/error;
6. verificar responsividade;
7. verificar acessibilidade.

Evitar criar várias versões do mesmo componente.

---

# 29. Regras para alterações

Uma IA trabalhando neste projeto deve evitar:

- mudanças não relacionadas à feature;
- refatorações oportunistas;
- renomeações desnecessárias;
- troca de bibliotecas sem justificativa;
- alteração de configurações sem necessidade;
- mudanças de estilo globais sem solicitação;
- remoção de código aparentemente não utilizado sem investigação;
- criação de abstrações prematuras.

### Regra prática

> Quanto menor a mudança necessária para resolver corretamente a feature, melhor.

Isso não significa evitar refatorações necessárias.

Significa evitar aumentar o escopo sem necessidade.

---

# 30. Git antes e depois da IA

Antes de uma alteração significativa:

```powershell
git status --short
```

Depois:

```powershell
git status --short
```

E:

```powershell
git diff --stat
```

Para arquivos específicos:

```powershell
git diff -- caminho/do/arquivo
```

Nunca assumir que uma alteração veio do Graphify apenas porque apareceu depois de executar o Graphify.

Separar:

- artefatos do Graphify;
- arquivos criados pelo workflow;
- alterações reais da aplicação;
- alterações anteriores já existentes no working tree.

---

# 31. Graphify não é um sistema de versionamento

O Graphify não deve ser usado como substituto do Git.

Use:

- **Git** para histórico e alterações;
- **Graphify** para relações arquiteturais;
- **código-fonte** para comportamento real;
- **documentação** para decisões e contexto.

---

# 32. Fluxo recomendado entre várias IAs

Este projeto pode utilizar:

- ChatGPT;
- Gemini;
- Claude;
- GitHub Copilot.

Todas devem trabalhar com o mesmo contexto.

### Contexto compartilhado

Sempre que possível, utilizar:

```text
AI_PROJECT_CONTEXT.md
GRAPH_REPORT.md
graph.json
```

e os arquivos relevantes.

### Regra

Nenhuma IA deve presumir que pode ignorar decisões existentes simplesmente porque consegue propor uma implementação diferente.

Se houver uma proposta arquitetural diferente:

1. explicar a diferença;
2. explicar o motivo;
3. explicar os impactos;
4. aguardar decisão quando a mudança for relevante.

---

# 33. Quando o grafo deve ser regenerado

Regenerar depois de mudanças como:

```text
nova API
novo domínio
novo serviço
novo fluxo
nova integração
nova tabela
grande refatoração
mudança de autenticação
mudança de middleware
mudança importante no Supabase
```

Para pequenas mudanças como:

```text
ajuste de texto
alteração de margem
mudança de cor
pequeno ajuste de layout
correção localizada
```

normalmente não é necessário atualizar imediatamente.

---

# 34. Checklist antes de implementar uma feature

```text
[ ] Li a descrição da feature.
[ ] Consultei GRAPH_REPORT.md.
[ ] Consultei graph.json quando necessário.
[ ] Localizei os arquivos relacionados.
[ ] Procurei implementação semelhante.
[ ] Identifiquei componentes reutilizáveis.
[ ] Identifiquei services/hooks/actions reutilizáveis.
[ ] Verifiquei APIs existentes.
[ ] Verifiquei banco/Supabase quando aplicável.
[ ] Verifiquei autenticação/autorização.
[ ] Verifiquei RLS quando aplicável.
[ ] Verifiquei multi-tenancy.
[ ] Analisei efeitos colaterais.
[ ] Defini o plano.
[ ] Só então comecei a implementação.
```

---

# 35. Checklist depois da implementação

```text
[ ] A feature funciona conforme solicitado.
[ ] Não foram criadas duplicações desnecessárias.
[ ] Os padrões existentes foram preservados.
[ ] Não foram alterados arquivos não relacionados sem motivo.
[ ] Tipagem está correta.
[ ] Erros são tratados.
[ ] Loading/empty/error states foram considerados.
[ ] Auth/RLS foram preservados.
[ ] Multi-tenancy foi preservado.
[ ] APIs existentes continuam compatíveis.
[ ] Migrations estão documentadas.
[ ] git diff foi revisado.
[ ] Testes/verificações foram executados.
[ ] Graphify será atualizado se a arquitetura mudou.
```

---

# 36. Regra de ouro para todas as IAs

> **Não invente a arquitetura do projeto. Descubra a arquitetura existente primeiro.**

O objetivo de usar IA neste projeto não é apenas gerar código rapidamente.

O objetivo é fazer a IA:

- entender o sistema;
- respeitar as decisões existentes;
- reutilizar código;
- identificar impactos;
- reduzir duplicação;
- implementar mudanças menores e mais seguras;
- manter a arquitetura consistente ao longo do tempo.

---

# 37. Contexto técnico conhecido

Este projeto utiliza/tem utilizado tecnologias como:

- Next.js;
- React;
- TypeScript;
- Tailwind CSS;
- Supabase;
- Cloudflare;
- Git/GitHub.

As versões podem mudar.

**Não assumir versões apenas com base neste documento.**

Sempre verificar:

```text
package.json
lockfile
configurações do projeto
```

antes de sugerir mudanças dependentes de versão.

---

# 38. Prioridade das fontes de informação

Quando houver conflito entre informações:

### 1º — Código-fonte atual

É a fonte principal para comportamento real.

### 2º — Banco/migrations/configuração atual

Principalmente para dados, RLS e infraestrutura.

### 3º — Graphify

Excelente para descobrir relações e arquitetura.

### 4º — Documentação do projeto

Útil para decisões e contexto.

### 5º — Conhecimento geral da IA

Deve ser usado para complementar, não para substituir o que existe no projeto.

---

# 39. Resumo operacional

Para qualquer nova feature:

```text
FEATURE
   ↓
GRAPH_REPORT.md
   ↓
graph.json
   ↓
arquivos relacionados
   ↓
análise de impacto
   ↓
verificar reutilização
   ↓
plano
   ↓
implementação
   ↓
testes
   ↓
git diff
   ↓
atualizar Graphify se necessário
```

Esse é o fluxo padrão de desenvolvimento assistido por IA do BarbeiroPass.

---

## Última regra

Se uma IA não tiver informação suficiente para tomar uma decisão arquitetural com segurança:

> **ela deve perguntar ou solicitar os arquivos necessários em vez de inventar.**
