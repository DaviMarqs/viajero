# Viajero API

API REST para gerenciamento de usuários, viajantes, planos de viagem, favoritos, avaliações e preferências.

## Tecnologias

- Python
- Django 6.0.3
- Django REST Framework
- django-cors-headers
- SQLite

## Estrutura do projeto

O projeto está dentro da pasta `api/` e foi dividido em apps Django:

- `app`: configuração principal do projeto (`settings.py`, `urls.py`, `asgi.py`, `wsgi.py`)
- `users`: autenticação e modelo de usuário customizado por e-mail
- `travelers`: dados pessoais do viajante
- `travelplans`: planos de viagem
- `favorites`: favoritos de planos
- `review`: avaliações de planos
- `user_preferences`: preferências de perfil do usuário
- `travel_preferences`: preferências da viagem

## Tecnologias e configurações identificadas no código

- Banco padrão configurado: `SQLite` em `api/db.sqlite3`
- Modelo de usuário customizado: `AUTH_USER_MODEL = 'users.User'`
- CORS liberado para:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- API construída majoritariamente com:
  - `generics.ListCreateAPIView`
  - `generics.RetrieveUpdateDestroyAPIView`
  - `viewsets.ModelViewSet`

## Classes do repositório

### App `users`

**Models**

- `UserManager`
- `User`

**Serializers**

- `UserSerializer`

**Views**

- `UserCreateListView`
- `UserRetrieveUpdateDestroy`

**Apps**

- `UsersConfig`

### App `travelers`

**Models**

- `Traveler`

**Serializers**

- `TravelerSerializer`

**Views**

- `TravelerCreateListView`
- `TravelerRetrieveUpdateDestroy`

**Apps**

- `TravelersConfig`

### App `travelplans`

**Models**

- `TravelPlan`

**Serializers**

- `TravelPlanSerializer`

**Views**

- `TravelPlanCreateListView`
- `TravelPlanRetrieveUpdateDestroy`

**Apps**

- `TravelplansConfig`

### App `favorites`

**Models**

- `Favorite`

**Serializers**

- `FavoriteSerializer`

**Views**

- `FavoriteCreateListView`
- `FavoriteRetrieveUpdateDestroy`

**Apps**

- `FavoritesConfig`

### App `review`

**Models**

- `Review`

**Serializers**

- `ReviewSerializer`

**Views**

- `ReviewCreateListView`
- `ReviewRetrieveUpdateDestroy`

**Apps**

- `ReviewConfig`

### App `user_preferences`

**Models**

- `UserPreference`

**Serializers**

- `UserPreferenceSerializer`

**Views**

- `UserPreferenceViewSet`

**Apps**

- `UserPreferencesConfig`

### App `travel_preferences`

**Models**

- `TravelPreference`

**Serializers**

- `TravelPreferenceSerializer`

**Views**

- `TravelPreferenceViewSet`

**Apps**

- `TravelPreferencesConfig`

## Modelos de domínio

### `User`

Usuário customizado com autenticação por e-mail.

Campos principais:

- `email`
- `is_active`
- `is_staff`
- `is_verified`
- `date_joined`

### `Traveler`

Perfil de viajante associado 1:1 com `User`.

Campos principais:

- `user`
- `first_name`
- `last_name`
- `phone_number`
- `date_of_birth`
- `document_id`

### `TravelPlan`

Plano de viagem vinculado a um usuário.

Campos principais:

- `user`
- `titulo`
- `destino_principal`
- `dados` (`JSONField`)
- `status`
- `created_at`
- `updated_at`

Status possíveis:

- `draft`
- `saved`
- `edited`

### `Favorite`

Relaciona um usuário a um plano favoritado.

Campos principais:

- `user`
- `travel_plan`
- `created_at`

Restrição:

- combinação única entre `user` e `travel_plan`

### `Review`

Avaliação de um plano de viagem.

Campos principais:

- `user`
- `travel_plan`
- `rating`
- `comentario`
- `created_at`

Regras:

- `rating` entre `0` e `10`
- combinação única entre `user` e `travel_plan`

### `UserPreference`

Preferências gerais de perfil do usuário.

Campos:

- `user`
- `traveler_type`
- `comfort_level`
- `companionship`
- `travel_pace`
- `travel_experience`

### `TravelPreference`

Preferências específicas de viagem.

Campos:

- `user`
- `duration_days`
- `budget`
- `climate`
- `interests` (`JSONField`)
- `restrictions` (`JSONField`)
- `created_at`

## Rotas

Rotas definidas em `api/app/urls.py`.

| Método | Rota | Classe responsável |
|---|---|---|
| Interface administrativa | `/admin/` | Django Admin |
| GET, POST | `/travel-plans/` | `TravelPlanCreateListView` |
| GET, PUT, PATCH, DELETE | `/travel-plans/<int:pk>` | `TravelPlanRetrieveUpdateDestroy` |
| GET, POST | `/favorites/` | `FavoriteCreateListView` |
| GET, PUT, PATCH, DELETE | `/favorites/<int:pk>` | `FavoriteRetrieveUpdateDestroy` |
| GET, POST | `/users/` | `UserCreateListView` |
| GET, PUT, PATCH, DELETE | `/users/<int:pk>/` | `UserRetrieveUpdateDestroy` |
| GET, POST | `/travelers/` | `TravelerCreateListView` |
| GET, PUT, PATCH, DELETE | `/travelers/<int:pk>/` | `TravelerRetrieveUpdateDestroy` |
| GET, POST | `/reviews/` | `ReviewCreateListView` |
| GET, PUT, PATCH, DELETE | `/reviews/<int:pk>` | `ReviewRetrieveUpdateDestroy` |
| GET, POST | `/user-preferences/` | `UserPreferenceViewSet` |
| GET, PUT, DELETE | `/user-preferences/<int:pk>/` | `UserPreferenceViewSet` |
| GET, POST | `/travel-preferences/` | `TravelPreferenceViewSet` |
| GET, PUT, DELETE | `/travel-preferences/<int:pk>/` | `TravelPreferenceViewSet` |

## Execução local

Exemplo básico de execução:

```bash
cd api
python manage.py migrate
python manage.py runserver
```

Servidor padrão:

- `http://127.0.0.1:8000/`
