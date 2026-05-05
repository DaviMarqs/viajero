from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from favorites.models import Favorite
from favorites.serializers import FavoriteSerializer
from helpers.responses import api_response


class FavoriteCreateListView(generics.ListCreateAPIView):
    queryset = Favorite.objects.all()
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        favorites = self.get_queryset()
        serializer = self.get_serializer(favorites, many=True)

        return api_response(
            status_bool=True,
            message="Lista de favoritos retornada com sucesso.",
            data=serializer.data,
            http_status=200
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save(user=request.user)

            return api_response(
                status_bool=True,
                message="Roteiro favoritado com sucesso.",
                data=serializer.data,
                http_status=201
            )

        return api_response(
            status_bool=False,
            message="Erro ao adicionar roteiro aos favoritos.",
            errors=serializer.errors,
            http_status=400
        )
    

class FavoriteRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        favorite = self.get_object()
        serializer = self.get_serializer(favorite)

        return api_response(
            status_bool=True,
            message="Favorito retornado com sucesso.",
            data=serializer.data
        )

    def destroy(self, request, *args, **kwargs):
        traveler = self.get_object()
        traveler.delete()

        return api_response(
            status_bool=True,
            message="Favorito removido com sucesso.",
            http_status=200  
        )