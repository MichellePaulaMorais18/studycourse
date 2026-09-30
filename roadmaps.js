/* Roadmaps de estudo (DevOps, QA, n8n, Dados) — um item por dia de estudo, agrupado por semana.
   O último texto de cada dia (opcional) são atalhos de LINKS: tópicos do edital que o dia conclui.
   Domingos de descanso não entram; só as revisões de fim de mês. */

const _SO = 'Sistemas Operacionais, Redes e Nuvem', _DEV = 'DevOps e Engenharia de Entrega', _DS = 'Desenvolvimento de Sistemas';
const _ES = 'Engenharia de Software', _BD = 'Banco de Dados', _IA = 'IA, Ciência de Dados e Automação';
const _SEG = 'Segurança da Informação', _LEG = 'Legislação Aplicada à TI';

const LINKS_EDITAL = {
  tcp:    [_SO, 'TCP/IP; IPv4 e IPv6; DNS e DHCP'],
  http:   [_SO, 'HTTP/2, HTTP/3, HTTPS, SMTP, FTP e SSH'],
  nuvem:  [_SO, 'Nuvem: IaaS, PaaS, SaaS e serverless'],
  virt:   [_SO, 'Virtualização e containers'],
  escal:  [_SO, 'Escalabilidade, alta disponibilidade, integração local-nuvem e monitoramento'],
  cicd:   [_DEV, 'CI/CD; pipelines; automação de build e testes'],
  iac:    [_DEV, 'Infraestrutura como código e gerenciamento de configuração'],
  obs:    [_DEV, 'Observabilidade: métricas, logs, traces, telemetria e alertas'],
  git:    [_DEV, 'Git distribuído; GitHub e GitLab'],
  branch: [_DEV, 'Branching: Git Flow e trunk-based development'],
  pr:     [_DEV, 'Pull/merge requests e revisão de código'],
  docker: [_DEV, 'Docker e Docker Compose'],
  k8s:    [_DEV, 'Orquestração com Kubernetes'],
  amb:    [_DEV, 'Ambientes de desenvolvimento, homologação e produção'],
  actions:[_DEV, 'GitHub Actions, GitLab CI/CD e Jenkins'],
  gitds:  [_DS, 'Controle de versão com Git'],
  api:    [_DS, 'APIs RESTful; GraphQL e WebSockets'],
  json:   [_DS, 'Formatos JSON e XML'],
  oauth:  [_DS, 'OAuth 2.0, OpenID Connect 1.0, tokens, claims e JWT'],
  logica: [_DS, 'Algoritmos, lógica de programação e estruturas de dados'],
  js:     [_DS, 'JavaScript e Node.js'],
  py:     [_DS, 'Python para automação e back-end'],
  sdlc:   [_ES, 'Fundamentos e ciclo de vida de software'],
  crit:   [_ES, 'Histórias de usuário, casos de uso e critérios de aceite'],
  testes: [_ES, 'Testes: unitários, integração, funcionais, regressão, carga e estresse; automatizados'],
  sql:    [_BD, 'SQL e álgebra relacional'],
  idx:    [_BD, 'Índices e otimização de consultas'],
  bkp:    [_BD, 'Replicação, backup e recuperação; alta disponibilidade'],
  dados:  [_IA, 'Ciência de dados: coleta, preparação, limpeza, transformação e análise'],
  stat:   [_IA, 'Estatística aplicada e avaliação de modelos'],
  ml:     [_IA, 'Aprendizado supervisionado, não supervisionado e por reforço'],
  bigd:   [_IA, 'Big Data: volume, velocidade e variedade'],
  acesso: [_SEG, 'Controle de acesso: autenticação, autorização e IAM'],
  segapi: [_SEG, 'Segurança em APIs, containers e nuvem'],
  lgpd:   [_LEG, 'LGPD (Lei nº 13.709/2018)']
};

// Itens das versões anteriores do plano (blocos por semanas), substituídos pelos itens por dia.
const BLOCOS_ANTIGOS = {
  'DevOps': ['Semanas 1-3 e 10 — Linux, redes e cloud', 'Semanas 5-11 — CI/CD, IaC, observabilidade, containers e Git'],
  'Dados':  ['Semanas 1, 8 e 9 — SQL, modelagem e ETL', 'Semanas 2 e 5-7 — Ciência de dados e IA'],
  'n8n':    ['Semana 3 — Credenciais, webhooks e LGPD', 'Semana 6 — APIs, OAuth2 e autenticação', 'Semanas 7, 8 e 10 — Self-hosting, escalabilidade e observabilidade'],
  'QA':     ['Semana 11 — Performance e automação de testes']
};

const ROADMAPS = [
  { nome: 'DevOps', semanas: [
    ['O que é DevOps?', [
      ['Seg', 'O que é DevOps: cultura, história e por que existe'],
      ['Ter', 'Ciclo DevOps (plan, code, build, test, release, deploy, operate, monitor)'],
      ['Qua', 'Instalar um ambiente Linux (WSL, VM ou distro nativa)'],
      ['Qui', 'Linux básico: navegação (ls, cd, pwd), arquivos (cp, mv, rm)'],
      ['Sex', 'Editores de texto no terminal (nano ou vim básico)'],
      ['Sáb', 'Revisão da semana + praticar 10 comandos básicos de Linux']] ],
    ['Linux avançado e shell scripting', [
      ['Seg', 'Permissões de arquivos (chmod, chown, usuários e grupos)'],
      ['Ter', 'Processos (ps, top, kill) e gerenciamento de pacotes (apt/yum)'],
      ['Qua', 'Redirecionamento e pipes (>, >>, |, grep, find)'],
      ['Qui', 'Introdução a shell scripting (variáveis, condicionais em bash)'],
      ['Sex', 'Shell scripting: loops e funções em bash'],
      ['Sáb', 'Praticar: escrever um script que automatiza uma tarefa simples']] ],
    ['Redes e Git', [
      ['Seg', 'Conceitos de rede: IP, portas, DNS, firewall (visão geral)', 'tcp'],
      ['Ter', 'HTTP/HTTPS, SSH e como funcionam conexões remotas', 'http'],
      ['Qua', 'Introdução ao Git (o que é controle de versão, init, add, commit)'],
      ['Qui', 'Git: push, pull, clone, .gitignore'],
      ['Sex', 'Criar conta no GitHub e subir um repositório', 'git'],
      ['Sáb', 'Prática: versionar um projeto pessoal simples', 'gitds']] ],
    ['Fluxos de trabalho Git e projeto real', [
      ['Seg', 'Branches: criar, alternar, mesclar (merge)'],
      ['Ter', 'Conflitos de merge e como resolvê-los', 'branch'],
      ['Qua', 'Pull Requests e revisão de código no GitHub', 'pr'],
      ['Qui', 'Boas práticas: commits semânticos, README, licenças'],
      ['Sex', 'Escolher um projeto público simples para clonar e explorar'],
      ['Sáb', 'Fazer uma contribuição (fork + PR) em um repositório de prática'],
      ['Dom', 'Revisão geral do Mês 1']] ],
    ['Introdução a Docker', [
      ['Seg', 'O que são containers e por que usá-los (vs VMs)', 'virt'],
      ['Ter', 'Instalar Docker e rodar o primeiro container (docker run hello-world)'],
      ['Qua', 'Comandos básicos (ps, images, stop, rm, logs)'],
      ['Qui', 'O que é uma imagem Docker e como funciona o Docker Hub'],
      ['Sex', 'Escrever seu primeiro Dockerfile'],
      ['Sáb', 'Praticar: containerizar uma aplicação simples (ex: app "Hello World")']] ],
    ['Docker avançado', [
      ['Seg', 'Volumes e persistência de dados'],
      ['Ter', 'Redes no Docker (bridge, host, comunicação entre containers)'],
      ['Qua', 'Introdução ao Docker Compose'],
      ['Qui', 'Escrever um docker-compose.yml com múltiplos serviços', 'docker'],
      ['Sex', 'Boas práticas de Dockerfile (camadas, .dockerignore, imagens menores)'],
      ['Sáb', 'Praticar: subir uma aplicação com banco de dados via Compose']] ],
    ['Fundamentos de CI/CD', [
      ['Seg', 'O que é Integração Contínua (CI) e Entrega/Deploy Contínuo (CD)'],
      ['Ter', 'Conceitos: pipeline, build, stage, job, artefato'],
      ['Qua', 'Comparar ferramentas (GitHub Actions, GitLab CI, Jenkins — visão geral)'],
      ['Qui', 'Testes automatizados dentro de um pipeline (visão geral)'],
      ['Sex', 'Estratégias de deploy (blue-green, canary, rolling — conceitual)'],
      ['Sáb', 'Ler/estudar um pipeline real de um projeto open source']] ],
    ['Pipeline real', [
      ['Seg', 'Configurar GitHub Actions (estrutura do arquivo .yml)'],
      ['Ter', 'Criar um workflow que roda testes automaticamente a cada push', 'actions'],
      ['Qua', 'Adicionar etapa de build de uma imagem Docker no pipeline'],
      ['Qui', 'Publicar a imagem no Docker Hub via pipeline', 'cicd'],
      ['Sex', 'Adicionar variáveis de ambiente e secrets no pipeline'],
      ['Sáb', 'Praticar mais um pipeline completo do zero em outro projeto'],
      ['Dom', 'Revisão geral do Mês 2']] ],
    ['Introdução ao Kubernetes', [
      ['Seg', 'Por que Kubernetes existe e quando usar (vs Docker sozinho)'],
      ['Ter', 'Conceitos: cluster, node, pod, deployment'],
      ['Qua', 'Instalar um cluster local (Minikube ou Kind)'],
      ['Qui', 'Criar e rodar o primeiro pod/deployment via kubectl'],
      ['Sex', 'Services e exposição de aplicações (ClusterIP, NodePort)', 'k8s'],
      ['Sáb', 'Praticar: subir a aplicação da Semana 6 no Kubernetes local']] ],
    ['Fundamentos de Cloud', [
      ['Seg', 'Conceitos de cloud: IaaS, PaaS, SaaS', 'nuvem'],
      ['Ter', 'Criar conta gratuita em um provedor (AWS, Azure ou GCP)'],
      ['Qua', 'Serviços de computação básicos (EC2/VM/Compute Engine)'],
      ['Qui', 'Armazenamento (S3/Blob Storage) e redes básicas na cloud (VPC)'],
      ['Sex', 'IAM: usuários, permissões e boas práticas de segurança', 'acesso'],
      ['Sáb', 'Praticar: subir uma máquina virtual e acessar via SSH']] ],
    ['Infraestrutura como Código e Observabilidade', [
      ['Seg', 'O que é Infraestrutura como Código (IaC) e por que usar'],
      ['Ter', 'Introdução ao Terraform (instalação, init, plan, apply)'],
      ['Qua', 'Escrever o primeiro arquivo .tf para criar um recurso simples', 'iac'],
      ['Qui', 'O que é observabilidade: logs, métricas e traces'],
      ['Sex', 'Introdução a Prometheus e Grafana (conceitos + instalação local)', 'obs'],
      ['Sáb', 'Praticar: criar um dashboard simples monitorando um container']] ],
    ['Portfólio e preparação final', [
      ['Seg', 'Organizar todos os projetos no GitHub com README explicativo'],
      ['Ter', 'Criar um projeto final combinando Docker + CI/CD + Kubernetes'],
      ['Qua', 'Montar/atualizar currículo com skills de DevOps'],
      ['Qui', 'Perfil no LinkedIn destacando o projeto final'],
      ['Sex', 'Estudar perguntas comuns de entrevista de DevOps'],
      ['Sáb', 'Simular uma entrevista técnica (responder em voz alta ou por escrito)']] ]
  ] },

  { nome: 'Dados', semanas: [
    ['Carreiras em Dados + SQL avançado', [
      ['Seg', 'Panorama das carreiras: Analista x Cientista x Engenheiro de Dados'],
      ['Ter', 'SQL: revisão de JOINs complexos (LEFT, RIGHT, FULL, self join)'],
      ['Qua', 'SQL: Window Functions (ROW_NUMBER, RANK, LAG/LEAD)'],
      ['Qui', 'SQL: CTEs e subqueries avançadas', 'sql'],
      ['Sex', 'SQL: otimização de queries e boas práticas', 'idx'],
      ['Sáb', 'Praticar: resolver 5 exercícios de SQL avançado (ex: StrataScratch, LeetCode SQL)']] ],
    ['Estatística aplicada + planilhas', [
      ['Seg', 'Estatística descritiva: média, mediana, moda, desvio padrão'],
      ['Ter', 'Distribuições de probabilidade (normal, básicas)'],
      ['Qua', 'Correlação vs causalidade + introdução a testes de hipótese'],
      ['Qui', 'Excel/Google Sheets avançado: tabelas dinâmicas'],
      ['Sex', 'Excel/Google Sheets avançado: funções (PROCV/VLOOKUP, ÍNDICE+CORRESP)'],
      ['Sáb', 'Praticar: análise estatística de um dataset simples em planilha']] ],
    ['Visualização de dados', [
      ['Seg', 'Princípios de dataviz: quando usar cada tipo de gráfico'],
      ['Ter', 'Introdução ao Power BI ou Tableau (escolher 1)'],
      ['Qua', 'Criar visualizações básicas na ferramenta escolhida'],
      ['Qui', 'Construir um dashboard interativo simples'],
      ['Sex', 'Storytelling com dados: como apresentar insights'],
      ['Sáb', 'Praticar: montar 1 dashboard completo com dataset público']] ],
    ['Projeto de análise fim a fim', [
      ['Seg', 'Escolher um dataset público (Kaggle, dados.gov.br, etc.)'],
      ['Ter', 'Explorar e limpar os dados (SQL ou planilha)'],
      ['Qua', 'Definir perguntas de negócio e extrair insights'],
      ['Qui', 'Construir dashboard/relatório com os achados'],
      ['Sex', 'Escrever um resumo executivo dos insights (storytelling)'],
      ['Sáb', 'Publicar o projeto no GitHub ou portfólio pessoal'],
      ['Dom', 'Revisão geral do Mês 1']] ],
    ['Python para dados: pandas e numpy', [
      ['Seg', 'Introdução ao pandas: Series e DataFrames'],
      ['Ter', 'Leitura de dados (CSV, JSON, Excel) com pandas'],
      ['Qua', 'Manipulação de dados: filtros, groupby, merge'],
      ['Qui', 'numpy: arrays e operações vetorizadas'],
      ['Sex', 'Estatística com pandas (describe, corr, value_counts)'],
      ['Sáb', 'Praticar: manipular um dataset real com pandas']] ],
    ['Limpeza de dados, EDA e visualização', [
      ['Seg', 'Tratamento de valores nulos e duplicados'],
      ['Ter', 'Tratamento de outliers e tipos de dados incorretos'],
      ['Qua', 'Análise Exploratória de Dados (EDA): estrutura de um bom EDA', 'dados'],
      ['Qui', 'Visualização com matplotlib'],
      ['Sex', 'Visualização com seaborn'],
      ['Sáb', 'Praticar: fazer um EDA completo de um dataset novo']] ],
    ['Introdução a Machine Learning', [
      ['Seg', 'O que é Machine Learning: aprendizado supervisionado x não supervisionado', 'ml'],
      ['Ter', 'Regressão Linear: teoria e casos de uso'],
      ['Qua', 'Classificação: teoria e casos de uso (ex: árvore de decisão)'],
      ['Qui', 'Introdução ao scikit-learn: treinar um primeiro modelo'],
      ['Sex', 'Avaliação de modelos: métricas básicas (acurácia, MAE, RMSE)', 'stat'],
      ['Sáb', 'Praticar: treinar um modelo simples com scikit-learn'],
      ['Dom', 'Revisão geral do Mês 2']] ],
    ['ETL/ELT, pipelines e nuvem (fundamentos)', [
      ['Seg', 'O que faz um Engenheiro de Dados: ETL x ELT'],
      ['Ter', 'Conceitos de pipelines de dados e orquestração'],
      ['Qua', 'Introdução à nuvem para dados (AWS, GCP ou Azure — visão geral)'],
      ['Qui', 'Armazenamento: bancos relacionais x data lakes'],
      ['Sex', 'Automatizar um pipeline simples em Python (extrair + transformar + salvar)', 'py'],
      ['Sáb', 'Praticar: criar um script de ETL simples de ponta a ponta']] ],
    ['Modelagem de dados e Data Warehouse', [
      ['Seg', 'Modelagem dimensional: fato e dimensão'],
      ['Ter', 'Esquema estrela x floco de neve'],
      ['Qua', 'O que é um Data Warehouse (ex: BigQuery, Snowflake, Redshift)'],
      ['Qui', 'Introdução ao dbt (transformação de dados)'],
      ['Sex', 'Boas práticas de nomenclatura e documentação de dados'],
      ['Sáb', 'Praticar: modelar um pequeno data warehouse fictício']] ],
    ['Big Data e ferramentas modernas', [
      ['Seg', 'O que é Big Data e quando ele é necessário', 'bigd'],
      ['Ter', 'Introdução ao Apache Spark (conceitos)'],
      ['Qua', 'Introdução ao Airflow: orquestração de pipelines'],
      ['Qui', 'Versionamento de dados e qualidade de dados (data quality checks)'],
      ['Sex', 'Panorama do mercado: qual trilha combina mais com você?'],
      ['Sáb', 'Praticar: rodar um exemplo simples de Spark ou Airflow (ambiente local/cloud free tier)']] ],
    ['Projeto final combinando tudo', [
      ['Seg', 'Escolher dataset e definir escopo do projeto final'],
      ['Ter', 'Extrair e organizar os dados (SQL/Python)'],
      ['Qua', 'Transformar e modelar os dados'],
      ['Qui', 'Analisar e visualizar (dashboard ou notebook)'],
      ['Sex', 'Documentar o pipeline e os insights'],
      ['Sáb', 'Publicar o projeto completo no GitHub com README explicativo']] ],
    ['Portfólio e preparação final', [
      ['Seg', 'Organizar todos os projetos no GitHub'],
      ['Ter', 'Montar/atualizar currículo com skills de Dados'],
      ['Qua', 'Perfil no LinkedIn destacando os projetos'],
      ['Qui', 'Estudar perguntas comuns de entrevista (técnicas e de caso)'],
      ['Sex', 'Revisar SQL e Python para entrevistas técnicas (live coding)'],
      ['Sáb', 'Simular uma entrevista técnica (responder em voz alta ou por escrito)']] ]
  ] },

  { nome: 'n8n', semanas: [
    ['Padrões de nomenclatura e organização', [
      ['Seg', 'Auditar seus workflows atuais: o que está desorganizado hoje'],
      ['Ter', 'Convenção de nomenclatura de workflows (prefixos por área/cliente/status)'],
      ['Qua', 'Convenção de nomenclatura de nodes (verbo + ação, evitar nomes padrão)'],
      ['Qui', 'Uso de tags e pastas/projetos para organização em escala'],
      ['Sex', 'Padronização de notas (sticky notes) explicando lógica complexa'],
      ['Sáb', 'Prática: aplicar o novo padrão em 2 workflows existentes']] ],
    ['Error handling padronizado', [
      ['Seg', 'Tipos de falha em automação (erro de API, timeout, dado inválido)'],
      ['Ter', 'Error Trigger workflow: como criar um workflow central de erros'],
      ['Qua', 'Try/Catch com "Error Output" nos nodes e branches de contingência'],
      ['Qui', 'Retry automático (node retry, backoff) x retry manual'],
      ['Sex', 'Notificações de erro padronizadas (Slack/Email/Telegram com contexto útil)'],
      ['Sáb', 'Prática: adicionar error handling padronizado a 1 workflow crítico']] ],
    ['Segurança', [
      ['Seg', 'Gestão de credenciais: boas práticas, escopo mínimo necessário'],
      ['Ter', 'Variáveis de ambiente (environment variables) x hardcoded values'],
      ['Qua', 'Segurança de webhooks (autenticação, validação de origem, HMAC)', 'segapi'],
      ['Qui', 'Controle de acesso: usuários, roles e permissões (se em equipe)', 'acesso'],
      ['Sex', 'LGPD/dados sensíveis: o que não deve trafegar sem tratamento em workflows', 'lgpd'],
      ['Sáb', 'Prática: revisar e corrigir credenciais/variáveis de 1 workflow real']] ],
    ['Documentação e versionamento', [
      ['Seg', 'Por que documentar automações (handoff, manutenção, auditoria)'],
      ['Ter', 'Estrutura de documentação: objetivo, gatilho, dependências, contatos'],
      ['Qua', 'Versionamento de workflows com Git (export JSON, n8n + Git)'],
      ['Qui', 'Ambientes: como versionar sem misturar dev e produção'],
      ['Sex', 'Changelog de automações: registrar o que mudou e por quê'],
      ['Sáb', 'Prática: documentar e versionar 2 workflows importantes'],
      ['Dom', 'Revisão geral do Mês 1']] ],
    ['JavaScript avançado no n8n', [
      ['Seg', 'Function/Code node: diferenças entre modo "Run Once" e "Run for Each Item"'],
      ['Ter', 'Manipulação avançada de arrays e objetos (map, filter, reduce)'],
      ['Qua', 'Expressões avançadas ($json, $node, $items, $now, $workflow)'],
      ['Qui', 'Funções reutilizáveis dentro do Code node'],
      ['Sex', 'Tratamento de datas e fusos horários em automações'],
      ['Sáb', 'Prática: refatorar um Function node complexo de um workflow real', 'js']] ],
    ['APIs avançadas', [
      ['Seg', 'Autenticação OAuth2 na prática (fluxo, refresh token)', 'oauth'],
      ['Ter', 'Rate limiting: como identificar e respeitar limites de API'],
      ['Qua', 'Retries com backoff exponencial e idempotência'],
      ['Qui', 'Paginação de APIs (offset, cursor, page token)', 'api'],
      ['Sex', 'Webhooks x polling: quando usar cada estratégia'],
      ['Sáb', 'Prática: implementar paginação/retry em uma integração real']] ],
    ['Self-hosting e DevOps para n8n', [
      ['Seg', 'n8n self-hosted x n8n cloud: trade-offs'],
      ['Ter', 'Rodar n8n com Docker/Docker Compose', 'docker'],
      ['Qua', 'Banco de dados do n8n (SQLite x PostgreSQL) e backups', 'bkp'],
      ['Qui', 'Variáveis de ambiente e configuração de produção'],
      ['Sex', 'Atualizações de versão sem quebrar workflows em produção'],
      ['Sáb', 'Prática: subir uma instância n8n self-hosted em ambiente de teste']] ],
    ['Escalabilidade', [
      ['Seg', 'Queue mode: o que é e quando é necessário'],
      ['Ter', 'Workers e execução distribuída', 'escal'],
      ['Qua', 'Performance: identificar workflows lentos ou pesados'],
      ['Qui', 'Limites de execução, timeout e otimização de payloads grandes'],
      ['Sex', 'Estratégias para workflows de alto volume (batch processing)'],
      ['Sáb', 'Prática: otimizar 1 workflow que processa grande volume de dados'],
      ['Dom', 'Revisão geral do Mês 2']] ],
    ['Reusabilidade e componentização', [
      ['Seg', 'Sub-workflows: quando extrair lógica repetida'],
      ['Ter', 'Execute Workflow node: passagem de dados entre workflows'],
      ['Qua', 'Templates internos: criar uma base reaproveitável para novos projetos'],
      ['Qui', 'Padronização de inputs/outputs entre sub-workflows'],
      ['Sex', 'Biblioteca pessoal de "componentes" (autenticação, notificação, log padrão)'],
      ['Sáb', 'Prática: transformar uma lógica repetida em sub-workflow reutilizável']] ],
    ['Observabilidade', [
      ['Seg', 'O que monitorar em automações (execuções, falhas, latência)'],
      ['Ter', 'Logs centralizados: registrar execuções importantes fora do n8n'],
      ['Qua', 'Dashboards simples de status de automações (planilha, Notion, BI)'],
      ['Qui', 'Alertas proativos (ex: "workflow não rodou hoje")', 'obs'],
      ['Sex', 'SLA de automações: definir o que é aceitável de tempo de resposta/erro'],
      ['Sáb', 'Prática: montar um painel simples de status dos seus workflows']] ],
    ['Qualidade e processos de deploy', [
      ['Seg', 'Ambientes separados: dev, staging e produção', 'amb'],
      ['Ter', 'Testes manuais estruturados antes de publicar um workflow'],
      ['Qua', 'Checklist de deploy (credenciais, variáveis, error handling, docs)'],
      ['Qui', 'Rollback: como reverter rapidamente uma automação com problema'],
      ['Sex', 'Revisão de workflows por pares (se em equipe) — checklist de review'],
      ['Sáb', 'Prática: criar seu checklist de deploy e aplicá-lo em 1 workflow']] ],
    ['Profissionalização e portfólio', [
      ['Seg', 'Criar um SOP (procedimento padrão) para novos projetos de automação'],
      ['Ter', 'Modelo de proposta/escopo para clientes (se freelancer)'],
      ['Qua', 'Case study: documentar 1 automação como estudo de caso para portfólio'],
      ['Qui', 'Perfil no LinkedIn/portfólio destacando especialização em automação'],
      ['Sex', 'Precificação e posicionamento (júnior x especialista em padronização)'],
      ['Sáb', 'Simular uma reunião de handoff/entrega de automação para um cliente']] ]
  ] },

  { nome: 'QA', pausada: true, semanas: [
    ['O que é QA?', [
      ['Seg', 'O que é Qualidade de Software e o papel do QA'],
      ['Ter', 'Diferença entre QA, QC e Teste'],
      ['Qua', 'Ciclo de vida de desenvolvimento de software (SDLC)', 'sdlc'],
      ['Qui', 'Ciclo de vida de testes (STLC)'],
      ['Sex', 'Tipos de teste: funcional x não funcional'],
      ['Sáb', 'Revisão da semana + quiz próprio (resumo em texto)']] ],
    ['Técnicas de teste', [
      ['Seg', 'Teste caixa preta (black box)'],
      ['Ter', 'Teste caixa branca (white box) e caixa cinza'],
      ['Qua', 'Particionamento de equivalência'],
      ['Qui', 'Análise de valor limite'],
      ['Sex', 'Tabela de decisão e transição de estado'],
      ['Sáb', 'Praticar: criar 5 casos de teste usando as técnicas']] ],
    ['Documentação de testes', [
      ['Seg', 'O que é um Plano de Teste'],
      ['Ter', 'Como escrever um Caso de Teste'],
      ['Qua', 'Critérios de aceite e cenários de teste (BDD/Gherkin)', 'crit'],
      ['Qui', 'Como reportar um Bug (severidade x prioridade)'],
      ['Sex', 'Ciclo de vida de um bug (aberto, reaberto, fechado)'],
      ['Sáb', 'Prática: escrever 3 bug reports de um site real']] ],
    ['Ferramentas e projeto real', [
      ['Seg', 'Ferramentas de gestão de teste (TestRail, Zephyr, Qase)'],
      ['Ter', 'Ferramentas de bug tracking (Jira, Trello)'],
      ['Qua', 'Escolher um site/app público para testar (ex: e-commerce demo)'],
      ['Qui', 'Criar plano de teste do projeto escolhido'],
      ['Sex', 'Executar 10 casos de teste manuais no projeto'],
      ['Sáb', 'Reportar bugs encontrados + finalizar documentação'],
      ['Dom', 'Revisão geral do Mês 1']] ],
    ['Lógica de programação + Git', [
      ['Seg', 'Lógica de programação: variáveis, condicionais'],
      ['Ter', 'Lógica de programação: loops e funções'],
      ['Qua', 'Introdução ao Git (o que é controle de versão)'],
      ['Qui', 'Comandos básicos: clone, add, commit, push'],
      ['Sex', 'Criar conta no GitHub e subir um repositório', 'gitds'],
      ['Sáb', 'Praticar exercícios de lógica (site tipo Codewars, nível fácil)']] ],
    ['Web e APIs (fundamentos)', [
      ['Seg', 'HTML básico: tags e estrutura'],
      ['Ter', 'CSS básico: seletores (útil para localizar elementos)'],
      ['Qua', 'O que é uma API e como funciona o protocolo HTTP'],
      ['Qui', 'Métodos HTTP (GET, POST, PUT, DELETE) e status codes', 'api'],
      ['Sex', 'O que é JSON e como ler uma resposta de API', 'json'],
      ['Sáb', 'Explorar uma API pública com o navegador/Postman']] ],
    ['Introdução à automação', [
      ['Seg', 'O que é automação de testes e quando usar'],
      ['Ter', 'Escolher linguagem: Python ou JavaScript (para automação)'],
      ['Qua', 'Instalar ambiente (Node.js ou Python) e editor (VS Code)'],
      ['Qui', 'Sintaxe básica da linguagem escolhida'],
      ['Sex', 'Estruturas de dados básicas (listas/arrays, dicionários/objetos)', 'logica'],
      ['Sáb', 'Escrever um script simples (ex: calculadora)']] ],
    ['Primeiros scripts de automação', [
      ['Seg', 'Introdução ao Selenium ou Cypress (escolher 1)'],
      ['Ter', 'Instalar e configurar a ferramenta'],
      ['Qua', 'Localizadores de elementos (id, classe, xpath, CSS selector)'],
      ['Qui', 'Criar primeiro teste automatizado (abrir página e clicar)'],
      ['Sex', 'Automatizar um login em site de teste (ex: saucedemo.com)'],
      ['Sáb', 'Praticar mais 2 cenários automatizados'],
      ['Dom', 'Revisão geral do Mês 2']] ],
    ['Automação avançada', [
      ['Seg', 'Padrão Page Object Model (POM)'],
      ['Ter', 'Implementar POM no projeto de automação'],
      ['Qua', 'Massa de dados: usar arquivos CSV/JSON nos testes'],
      ['Qui', 'Asserções e validações (assert)'],
      ['Sex', 'Relatórios de teste (Allure, HTML Report)'],
      ['Sáb', 'Refatorar os testes já criados usando POM']] ],
    ['Testes de API', [
      ['Seg', 'Instalar e configurar Postman/Insomnia'],
      ['Ter', 'Criar requisições GET e POST'],
      ['Qua', 'Testes automatizados de API (Postman Collections/Newman)'],
      ['Qui', 'Validação de schema JSON'],
      ['Sex', 'Autenticação em APIs (token, API key)'],
      ['Sáb', 'Criar uma coleção completa de testes de API de um projeto público']] ],
    ['Testes de performance', [
      ['Seg', 'O que é teste de performance (carga, estresse, pico)'],
      ['Ter', 'Introdução ao JMeter ou k6 (escolher 1)'],
      ['Qua', 'Criar primeiro teste de carga simples', 'testes'],
      ['Qui', 'Analisar métricas (tempo de resposta, throughput, erros)'],
      ['Sex', 'Testar performance de uma API pública'],
      ['Sáb', 'Gerar relatório de performance']] ],
    ['Portfólio e preparação final', [
      ['Seg', 'Organizar todos os projetos no GitHub com README explicativo'],
      ['Ter', 'Criar um projeto final combinando manual + automação + API'],
      ['Qua', 'Montar/atualizar currículo com skills de QA'],
      ['Qui', 'Perfil no LinkedIn destacando o projeto'],
      ['Sex', 'Estudar perguntas comuns de entrevista de QA'],
      ['Sáb', 'Simular uma entrevista técnica (responder em voz alta ou por escrito)']] ]
  ] }
];

// Converte ROADMAPS no formato que a importação de trilhas entende (um item por dia, agrupado por semana).
function roadmapsComoTrilhas() {
  return ROADMAPS.map(r => ({
    nome: r.nome,
    pausada: !!r.pausada,
    itens: r.semanas.flatMap(([tema, dias], s) => dias.map(([dia, texto, ...atalhos]) => ({
      titulo: `S${s + 1} · ${dia} — ${texto}`,
      grupo: `Semana ${s + 1} — ${tema}`,
      nota: '',
      vinculos: atalhos.map(a => ({ materia: LINKS_EDITAL[a][0], topico: LINKS_EDITAL[a][1] }))
    })))
  }));
}
