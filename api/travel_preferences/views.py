from django.shortcuts import render
from rest_framework import viewsets
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from travel_preferences.models import TravelPreference
from travel_preferences.serializers import TravelPreferenceSerializer
from helpers.responses import api_response


class TravelPreferenceViewSet(viewsets.ModelViewSet):
    queryset = TravelPreference.objects.all()
    serializer_class = TravelPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TravelPreference.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        travel_preferences = self.get_queryset()
        serializer = self.get_serializer(travel_preferences, many=True)

        return api_response(
            status_bool=True,
            message="Lista de preferências de viagem retornada com sucesso",
            data=serializer.data,
            http_status=200
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save(user=request.user)

            return api_response(
                status_bool=True,
                message="Onboarding de preferências de viagem respondido com sucesso.",
                data=serializer.data,
                http_status=201
            )

        return api_response(
            status_bool=False,
            message="Erro salvar preferências de viagem.",
            errors=serializer.errors,
            http_status=400
        )
    
class TravelPreferenceRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TravelPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TravelPreference.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        travel_preference = self.get_object()
        serializer = self.get_serializer(travel_preference)

        return api_response(
            status_bool=True,
            message="Preferências da viagem retornadas com sucesso.",
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        travel_preference = self.get_object()
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(travel_preference, data=request.data, partial=partial)

        if serializer.is_valid():
            serializer.save()

            return api_response(
                status_bool=True,
                message="Preferências de viagem atualizadas com sucesso.",
                data=serializer.data
            )

        return api_response(
            status_bool=False,
            message="Erro ao atualizar preferências de viagem.",
            errors=serializer.errors,
            http_status=400
        )

    def destroy(self, request, *args, **kwargs):
        travel_preference = self.get_object()
        travel_preference.delete()

        return api_response(
            status_bool=True,
            message="Preferências de viagem excluídas com sucesso. Responsa novamente o onboarding para ter uma experiência mais personalizada.",
            http_status=200  
        )

