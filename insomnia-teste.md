Fluxo completo de teste no Insomnia

Antes de tudo: confira que o ambiente Base Environment tem base_url = http://127.0.0.1:8000 e suba o server (cd backend && uv run manage.py runserver).

1. Criar conta — pasta Auth → request Register

POST {{ base_url }}/api/auth/register/

Body já vem preenchido com user@example.com / password123. Pode rodar como está, ou trocar o email se já existir. Espere 201 com {success, message, data: {access, refresh, user}}.

▎ Não precisa fazer nada com o token desta resposta — o login na etapa 2 já te dá um novo.

2. Login — pasta Auth → request Login

POST {{ base_url }}/api/auth/login/

Body com as mesmas credenciais. Resposta:
{ "data": { "access": "eyJhbGc...", "refresh": "..." } }

Copie o access e cole no environment do Insomnia:
- Manage Environments → Base Environment → jwt: "eyJhbGc..."
- Salve.

A partir daqui, todas as requests protegidas vão mandar Authorization: Bearer {{ jwt }} automaticamente (já vem configurado).

3. (Opcional) Confirmar usuário — pasta Users → Me (GET)

GET {{ base_url }}/api/users/me/ — só pra validar que o token tá ok. Esperado 200 com o usuário.

4. Disparar a descoberta via Firecrawl — pasta Destinations → Search (GET)

GET {{ base_url }}/api/destinations/search/?q=Aveiro

Edite o parâmetro q pra algo que NÃO está no seed (Aveiro, Bruges, Hanoi, qualquer coisa fora de Lisboa/Tokyo/etc do seed). Deixe country e city vazios.

Essa request é AllowAny, então funciona sem o JWT. Vai demorar 20–60s na primeira chamada (Firecrawl /search + /scrape + extract). Resposta:
{
  "success": true,
  "message": "Resultados carregados (destino enriquecido via Firecrawl).",
  "data": [
    {
      "id": 42,
      "slug": "aveiro",
      "name": "Aveiro",
      "country": "Portugal",
      "city": "Aveiro",
      "summary": "...",
      "pois": [...],
      "cost_profile": {...}
    }
  ]
}

Anote o id retornado.

5. Confirmar que voltou pro DB — repita Search (GET)

Rode a mesma request de novo com o mesmo q. Agora deve responder instantaneamente e a message muda pra "Resultados da busca carregados com sucesso." (cache hit — não chamou Firecrawl).

GET {{ base_url }}/api/destinations/

Esse exige JWT (já configurado no header). Você vai ver o destino que o Firecrawl criou no meio dos do seed. Resposta paginada/listada com tudo.

7. Detalhe do destino criado — pasta Destinations → Retrieve (GET)

Cole o id do passo 4 no env (destination_id) e dispare:
GET {{ base_url }}/api/destinations/{{ destination_id }}/

Esperado: o destino completo com pois[] (com tags) e cost_profile.

8. (Bônus) Conferir auditoria — pasta Audit Logs → List (GET)

Precisa de usuário admin (uv run manage.py createsuperuser se não tem) e relogar pra pegar token de admin. Espere encontrar um evento firecrawl.discovered com metadata.query = "Aveiro".

---
Resumo dos vars do env que você vai mexer

┌────────────────┬────────────────────────────┬──────────────────────────────────┐
│      Var       │      Quando preencher      │              Origem              │
├────────────────┼────────────────────────────┼──────────────────────────────────┤
│ jwt            │ Após Login                 │ data.access da resposta de Login │
├────────────────┼────────────────────────────┼──────────────────────────────────┤
│ destination_id │ Após Search com cache miss │ data[0].id da resposta           │
└────────────────┴────────────────────────────┴──────────────────────────────────┘

Se algo der errado

- 401 em qualquer rota protegida → token expirou/errado, refaça Login.
- Search demora muito e estoura → confirme FIRECRAWL_API_KEY no .env e veja o log do runserver (mensagens via logger.exception da services.py).
- Search volta data: [] mesmo em miss → o Firecrawl /search não achou URLs pra essa query, ou key inválida (401 log). Tente uma query mais conhecida (Porto, Buenos Aires).
