from django.contrib import admin
from django.urls import path
from travelplans.views import (
    TravelPlanCreateListView,
    TravelPlanRetrieveUpdateDestroy,
)
from favorites.views import (
    FavoriteCreateListView,
    FavoriteRetrieveUpdateDestroy,
)

from usuarios.views import (
    PreferenciaUsuarioViewSet,
    PreferenciaViagemViewSet,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('travel-plans/', TravelPlanCreateListView.as_view(), name='travel-plan-create-list'),
    path('travel-plans/<int:pk>', TravelPlanRetrieveUpdateDestroy.as_view(), name='travel-plan-detail-view'),
    path('favorites/', FavoriteCreateListView.as_view(), name='favorite-create-list'),
    path('favorites/<int:pk>', FavoriteRetrieveUpdateDestroy.as_view(), name='favorite-detail-view'),
    path('preferencias-usuario/', PreferenciaUsuarioViewSet.as_view({'get': 'list', 'post': 'create'}), name='preferencia-usuario-list'),
    path('preferencias-usuario/<int:pk>/', PreferenciaUsuarioViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='preferencia-usuario-detail'),
    path('preferencias-viagem/', PreferenciaViagemViewSet.as_view({'get': 'list', 'post': 'create'}), name='preferencia-viagem-list'),
    path('preferencias-viagem/<int:pk>/', PreferenciaViagemViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='preferencia-viagem-detail'),
]
