# Usar o DeepSeek como IA do Viajero

O DeepSeek é um provedor de IA pré-pago (você recarrega saldo e paga por uso). No Viajero ele é um provedor próprio, ao lado de Groq e Gemini, e o modelo padrão é o `deepseek-flash`, barato e rápido.

## 1. Criar a conta

1. Acesse https://platform.deepseek.com e clique em **Sign up**.
2. Cadastre com e-mail e senha (ou o login social disponível) e confirme o e-mail pelo código recebido.
3. Entre no painel (**API Platform**).

## 2. Recarregar saldo

A API só responde com saldo. Sem saldo ela devolve HTTP 402 e o Viajero passa para o próximo provedor ou para o gerador mock.

1. No painel, abra **Top up** (menu lateral, seção de saldo/billing).
2. Escolha o valor e a forma de pagamento oferecida (cartão ou os métodos que o painel listar para o seu país).
3. Confirme. O saldo aparece em **Balance**, em dólar ou yuan conforme a moeda escolhida.

O valor mínimo e os meios de pagamento variam e só aparecem no painel, então confira lá. Para uso de desenvolvimento e apresentação, um valor pequeno costuma bastar (veja custos abaixo).

## 3. Gerar a chave de API

1. Acesse https://platform.deepseek.com/api_keys.
2. Clique em **Create new API key**, dê um nome (ex.: `viajero-dev`) e confirme.
3. **Copie a chave na hora.** Ela só é exibida uma vez; se perder, crie outra e apague a antiga.
4. Nunca commite a chave nem a envie em chat ou print.

## 4. Configurar o Viajero

Edite `backend-nest/.env` (crie a partir do `.env.example` se não existir):

```
DEFAULT_LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-sua-chave-aqui
DEEPSEEK_MODEL=deepseek-flash
```

Os demais valores têm padrão e são opcionais:

| Variável | Padrão | Para que serve |
|---|---|---|
| `DEEPSEEK_API_URL` | `https://api.deepseek.com` | Endereço da API |
| `DEEPSEEK_TIMEOUT` | 30 | Timeout (s) das chamadas curtas |
| `DEEPSEEK_ITINERARY_TIMEOUT` | 90 | Timeout (s) da geração de roteiro |
| `DEEPSEEK_MAX_TOKENS` | 8192 | Limite de resposta padrão |
| `DEEPSEEK_THINKING` | `false` | `true` liga o modo pensamento (mais lento e mais caro) |

Se mantiver chaves do Groq/Gemini, elas viram reserva caso o DeepSeek falhe. Para usar só o DeepSeek, deixe `GROQ_API_KEY` e `GEMINI_API_KEY` vazias.

## 5. Reiniciar e testar

- Docker: `docker compose up --build -d` (ou `docker compose restart api`).
- Local: reinicie o Nest.
- Gere um roteiro pelo app. Se tudo estiver certo, os logs da API não mostram erro de IA e o roteiro sai com textos em português, não o texto em inglês do gerador mock.
- Confira os logs: `docker compose logs api --tail 50`.

## 6. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Roteiro sai em inglês ("Day 1: ...") | Chave vazia/errada, `DEFAULT_LLM_PROVIDER=mock`, ou `.env` não recarregado |
| Log `DeepSeek sem saldo (HTTP 402)` | Saldo zerado: recarregue |
| Log `DeepSeek auth (HTTP 401)` | Chave inválida, copiada incompleta ou apagada |
| Log `DeepSeek timeout` | Aumente `DEEPSEEK_ITINERARY_TIMEOUT` |
| Log `DeepSeek retornou resposta vazia` | A API não gerou JSON válido; o Viajero tenta de novo sozinho |

## 7. Custo

Valores da página oficial de preços (por 1 milhão de tokens, no `deepseek-flash`): entrada ~US$ 0,15 (cache miss) e saída ~US$ 0,60, com preço dobrado em horário de pico (01h–04h e 06h–10h UTC, dias úteis). Um roteiro usa em torno de 4 a 6 mil tokens, ou seja, frações de centavo por roteiro. Confira sempre os preços atuais em https://api-docs.deepseek.com/quick_start/pricing, pois mudam.

O limite de uso do DeepSeek é por concorrência (muitas requisições simultâneas), não por minuto, então o aviso de "limite de tokens por minuto" do plano gratuito do Groq não existe aqui.
