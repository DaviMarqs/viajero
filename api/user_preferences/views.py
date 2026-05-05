from rest_framework import viewsets, generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import UserPreference
from .serializers import UserPreferenceSerializer
from helpers.responses import api_response


class UserPreferenceViewSet(viewsets.ModelViewSet):
    queryset = UserPreference.objects.all()
    serializer_class = UserPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserPreference.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        user_preferences = self.get_queryset()
        serializer = self.get_serializer(user_preferences, many=True)

        return api_response(
            status_bool=True,
            message="DNA do viajante recuperado com sucesso.",
            data=serializer.data,
            http_status=200
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save(user=request.user)

            return api_response(
                status_bool=True,
                message="DNA do viajante criado com sucesso.",
                data=serializer.data,
                http_status=201
            )

        return api_response(
            status_bool=False,
            message="Erro ao DNA do viajante.",
            errors=serializer.errors,
            http_status=400
        )

class UserPreferenceRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserPreference.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        user_preference = self.get_object()
        serializer = self.get_serializer(user_preference)

        return api_response(
            status_bool=True,
            message="DNA do viajante recuperado com sucesso.",
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        user_preference = self.get_object()
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(user_preference, data=request.data, partial=partial)

        if serializer.is_valid():
            serializer.save()

            return api_response(
                status_bool=True,
                message="DNA do viajante atualizado com sucesso.",
                data=serializer.data
            )

        return api_response(
            status_bool=False,
            message="Erro ao atualizar DNA do viajante.",
            errors=serializer.errors,
            http_status=400
        )

    def destroy(self, request, *args, **kwargs):
        user_preference = self.get_object()
        user_preference.delete()

        return api_response(
            status_bool=True,
            message="DNA do viajante excluído com sucesso. Responda novamente ao onboarding para ter uma experiência mais personalizada.",
            http_status=200  
        )