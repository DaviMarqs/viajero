# Viajero

Viajero is a greenfield Django + DRF backend and React frontend for AI-assisted travel itinerary generation.

## What is implemented

- Django modular domain apps for users, destinations, profiles, itineraries, LLM jobs, audit logs, and Firecrawl ingestion.
- JWT-style login/register endpoints using `djangorestframework-simplejwt`.
- Itinerary generation service with a deterministic mock generator when no real LLM key is configured.
- Firecrawl ingestion service with a safe mock fallback when no `FIRECRAWL_API_KEY` is configured.
- React app with 12 route-level screens covering discovery, auth, onboarding, generation, itinerary review, favorites, and Firecrawl admin flow.

## Assumptions

- The attached schema file was not present in the workspace, so the backend model relationships were derived from the prompt and the logical FK corrections explicitly listed there.
- The referenced Figma file could not be accessed by the authenticated MCP user (`danillo.monteiro324@alunos.fho.edu.br`), so the frontend implements the full screen flow and a reusable visual system, but not pixel-perfect fidelity to the blocked source file yet.
- The repository was empty, so the project was scaffolded from scratch instead of adapting existing example code.

## Manual setup

1. Install `uv` and Node 20+ locally. `uv` can provision Python automatically, so a separate Python installation is not required.
2. Backend setup:
   - `cd backend`
   - `uv python install 3.12`
   - `uv sync`
   - `uv run manage.py makemigrations`
   - `uv run manage.py migrate`
   - `uv run manage.py loaddata seed_data.json`
   - `uv run manage.py runserver`
3. Frontend setup:
   - `cd frontend`
   - `npm install`
   - `npm run dev`
4. Configure environment variables:
   - `DJANGO_SECRET_KEY`
   - `DATABASE_URL`
   - `DEBUG`
   - `ALLOWED_HOSTS`
   - `CORS_ALLOWED_ORIGINS`
   - `JWT_SECRET_KEY`
   - `FIRECRAWL_API_KEY`
   - `FIRECRAWL_API_URL`
   - `DEFAULT_LLM_PROVIDER`
   - `DEFAULT_LLM_MODEL`
   - `LLM_API_KEY`
5. Fix Figma MCP access by sharing the file `ICoWCyoTKzciyBLoaMEXp7` with the authenticated account or authenticating the MCP server as a user that can open it.

## Notes

- Generate real migrations after `uv sync`. They are not included because the current environment initially had no runnable Python.
- Replace the mock generator in `backend/apps/ai/services.py` with a concrete provider adapter once the provider choice is finalized.
- Expand tests after the runtimes are installed.
