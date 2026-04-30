from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Traveler
from .serializers import TravelerSerializer
from helpers.responses import api_response


class TravelerCreateListView(generics.ListCreateAPIView):
    queryset = Traveler.objects.all()
    serializer_class = TravelerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Traveler.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        travelers = self.get_queryset()
        serializer = self.get_serializer(travelers, many=True)

        return api_response(
            status_bool=True,
            message="Lista de viajantes recuperada com sucesso.",
            data=serializer.data,
            http_status=200
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save(user=request.user)

            return api_response(
                status_bool=True,
                message="Viajante criado com sucesso.",
                data=serializer.data,
                http_status=201
            )

        return api_response(
            status_bool=False,
            message="Erro ao criar viajante.",
            errors=serializer.errors,
            http_status=400
        )
    

class TravelerRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TravelerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Traveler.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        traveler = self.get_object()
        serializer = self.get_serializer(traveler)

        return api_response(
            status_bool=True,
            message="Viajante recuperado com sucesso.",
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        traveler = self.get_object()
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(traveler, data=request.data, partial=partial)

        if serializer.is_valid():
            serializer.save()

            return api_response(
                status_bool=True,
                message="Viajante atualizado com sucesso.",
                data=serializer.data
            )

        return api_response(
            status_bool=False,
            message="Erro ao atualizar viajante.",
            errors=serializer.errors,
            http_status=400
        )

    def destroy(self, request, *args, **kwargs):
        traveler = self.get_object()
        traveler.delete()

        return api_response(
            status_bool=True,
            message="Viajante removido com sucesso.",
            http_status=200  
        )