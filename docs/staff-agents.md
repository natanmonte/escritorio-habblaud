# Equipe de agentes do Habblaud

O painel fica em `/staff.html`. Ele usa a API `/api/workspace/orders` e o gerente Theo cria tarefas para especialistas:

- Theo: coordenação e consolidação
- Nina: pesquisa e análise
- Maya: marketing
- Luca: copywriting
- Íris: design e UX

## Configurar o provedor de IA

O servidor precisa de uma chave de API compatível com a API Chat Completions:

- `HABBLAUD_AI_API_KEY` ou `OPENAI_API_KEY`: chave privada do provedor.
- `HABBLAUD_AI_BASE_URL`: opcional; padrão `https://api.openai.com/v1`.
- `HABBLAUD_AI_MODEL`: opcional; padrão `gpt-4.1-mini`.

Configure essas variáveis como secrets/variáveis privadas no ambiente do servidor. **Nunca coloque a chave no HTML, no JavaScript do navegador ou no GitHub.** Chamadas ao modelo são cobradas pelo provedor conforme o plano e o uso. Defina limites de gastos no provedor.

## API

- `GET /api/workspace/orders`: lista ordens e informa se a chave foi detectada.
- `POST /api/workspace/orders`: recebe `{"instruction":"..." }`.
- `GET /api/workspace/orders/:id`: consulta uma ordem.

Ordens, tarefas, resultados e conversas são persistidos em `<HABBLAUD_DATA_DIR>/staff/orders.json`.

## O que esta primeira versão faz

O gerente cria tarefas com base no pedido, encaminha-as aos especialistas em sequência, compartilha o contexto das entregas anteriores e consolida um relatório. A conversa entre agentes é registrada no histórico da ordem.

A equipe usa um modelo de linguagem por API; os nomes/personas são papéis de trabalho, não processos independentes com consciência ou execução ilimitada. A pesquisa não navega na internet nesta versão: Nina só pode analisar o contexto e os materiais fornecidos. Não há execução de código, envio de mensagens externas ou ações irreversíveis pelos agentes.

A interface do escritório visual original continua separada. O painel de operação é acessado por `/staff.html`.
