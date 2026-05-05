from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import User
from .serializers import UserSerializer
from helpers.responses import api_response


class UserCreateListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return User.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        users = self.get_queryset()
        serializer = self.get_serializer(users, many=True)

        return api_response(
            status_bool=True,
            message="Lista de usuários recuperada com sucesso.",
            data=serializer.data,
            http_status=200
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save(user=request.user)

            return api_response(
                status_bool=True,
                message="Usuário criado com sucesso.",
                data=serializer.data,
                http_status=201
            )

        return api_response(
            status_bool=False,
            message="Erro ao criar usuário.",
            errors=serializer.errors,
            http_status=400
        )


class UserRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return User.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user)

        return api_response(
            status_bool=True,
            message="Usuário recuperado com sucesso.",
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(user, data=request.data, partial=partial)

        if serializer.is_valid():
            serializer.save()

            return api_response(
                status_bool=True,
                message="Viajante atualizado com sucesso.",
                data=serializer.data
            )

        return api_response(
            status_bool=False,
            message="Erro ao atualizar usuário.",
            errors=serializer.errors,
            http_status=400
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.delete()

        return api_response(
            status_bool=True,
            message="Usuário removido com sucesso.",
            http_status=200  
        )