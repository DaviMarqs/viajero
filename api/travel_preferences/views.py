from django.shortcuts import render
from rest_framework import viewsets
from travel_preferences.models import TravelPreference
from rest_framework.permissions import IsAuthenticated
from travel_preferences.serializers import TravelPreferenceSerializer


class TravelPreferenceViewSet(viewsets.ModelViewSet):
    queryset = TravelPreference.objects.all()
    serializer_class = TravelPreferenceSerializer
    permission_classes = [IsAuthenticated]

    # Filtra para retornar apenas as preferências do usuário logado
    def get_queryset(self):
        return TravelPreference.objects.filter(user=self.request.user)
    
    # Salva a preferência de acordo com o usuário logado
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)