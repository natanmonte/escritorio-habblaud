# Executar o Habblaud na nuvem

Este guia prepara o Habblaud para uma máquina Linux remota. **Não é necessário instalar nada no computador pessoal.** O navegador acessa o endereço público; a aplicação, os processos dos agentes e os dados ficam no servidor.

## O que já funciona sem uma máquina remota

- O código-fonte e o histórico ficam no GitHub.
- O cliente web pode ser compilado com npm run build:client.
- A imagem Docker pode ser construída com o Dockerfile deste repositório.
- A interface pode ser publicada separadamente, mas sem o servidor Node e os agentes ela não é um escritório operacional.

## O que exige uma máquina sempre ligada

O Habblaud original não é um backend serverless. O servidor usa Node.js, observa arquivos de sessões do Claude Code/Codex, mantém conexões SSE, executa tarefas periódicas e pode iniciar processos/terminais. Cloudflare Pages/Workers não substituem esse processo persistente.

Para o modo remoto completo, use uma VM Linux ou VPS com Docker. O computador pessoal não participa da execução.

## Requisitos da futura VM

- Linux x86_64 ou ARM64 compatível com a imagem Node 24.
- Docker Engine e Docker Compose v2.
- Armazenamento persistente para /data e para os diretórios de sessão.
- Claude Code e/ou Codex configurados na própria VM, com credenciais de API/conta próprias.
- HTTPS e autenticação na frente do serviço (Cloudflare Tunnel/Access ou proxy HTTPS equivalente).

> Não copie credenciais, tokens ou diretórios de autenticação do computador pessoal para um repositório Git. Configure-os diretamente na VM, com permissões restritas.

## Preparação da VM

1. Instale Docker Engine e o plugin Docker Compose.
2. Instale e autentique Claude Code e/ou Codex na conta de serviço do servidor, seguindo a documentação oficial de cada ferramenta.
3. Clone este repositório ou use a imagem publicada pelo GitHub Actions.
4. Prepare diretórios persistentes para as sessões. O Habblaud precisa ler os diretórios de sessões do agente; não basta publicar a interface.
5. Configure o Compose para montar apenas os diretórios estritamente necessários, nunca o diretório inteiro de credenciais.
6. Coloque o serviço atrás de HTTPS e autenticação. Não exponha diretamente a porta 4747 à internet.

## Variáveis e segurança

- HABBLAUD_HOST=0.0.0.0: necessário dentro do container.
- HABBLAUD_IN_DOCKER=1: informa que o processo está em container.
- HABBLAUD_DATA_DIR=/data: estado persistente.
- HABBLAUD_AI_API_KEY: chave do provedor compatível com a API OpenAI para o gerente e a equipe.
- HABBLAUD_AI_BASE_URL: opcional; endpoint compatível com `/v1` (padrão: API da OpenAI).
- HABBLAUD_AI_MODEL: opcional; modelo usado pela equipe (padrão: `gpt-4.1-mini`).
- HABBLAUD_ALLOWED_HOSTS: hosts públicos autorizados, se aplicável.
- HABBLAUD_TERMINAL=0 e HABBLAUD_MENSAGENS=0: mantenha recursos de terminal/mensagens desligados enquanto a arquitetura de autenticação remota não for revisada para o seu cenário.

Os transcripts podem conter informações confidenciais, comandos e trechos de código. Restrinja o acesso ao painel e faça backup criptografado do volume de dados.

## Situação do modo nuvem

A imagem Docker e a documentação deixam o projeto pronto para ser instalado em uma VM quando houver uma. Isso não cria uma VM gratuita automaticamente. Oracle Cloud Always Free pode ser tentada quando houver capacidade, mas disponibilidade, limites e elegibilidade dependem da conta e da região.

## Equipe de trabalho integrada

O fork inclui um gerente (Theo) e especialistas (Nina, Maya, Luca e Íris). O botão **Equipe** aparece dentro da interface original do escritório. As ordens são persistidas em `/data/staff/orders.json`, distribuídas em tarefas sequenciais, e a interface acompanha estados, mensagens e entregas. É necessário configurar `HABBLAUD_AI_API_KEY` (ou `OPENAI_API_KEY`) no servidor. Sem a chave, a equipe informa que está indisponível e as tarefas não são simuladas como concluídas.

Essa equipe de IA é separada dos agentes Claude Code/Codex que aparecem no mapa original. Ela ainda não controla os personagens/sessões reais do Habblaud, não executa ações externas por conta própria e não tem navegação web ou execução de código. O painel mostra as conversas e o estado verdadeiro das tarefas dessa camada; não altera artificialmente o status dos personagens do escritório.
