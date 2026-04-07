from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PreferenciaUsuarioViewSet, PreferenciaViagemViewSet

router = DefaultRouter()
router.register(r'usuarios', PreferenciaUsuarioViewSet)
router.register(r'viagens', PreferenciaViagemViewSet)

urlpatterns = [
    path('', include(router.urls)),
]