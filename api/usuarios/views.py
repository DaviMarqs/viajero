from rest_framework import viewsets
from .models import PreferenciaUsuario, PreferenciaViagem
from .serializers import PreferenciaUsuarioSerializer, PreferenciaViagemSerializer


class PreferenciaUsuarioViewSet(viewsets.ModelViewSet):
    queryset = PreferenciaUsuario.objects.all()
    serializer_class = PreferenciaUsuarioSerializer


class PreferenciaViagemViewSet(viewsets.ModelViewSet):
    queryset = PreferenciaViagem.objects.all()
    serializer_class = PreferenciaViagemSerializer