from rest_framework import generics, status
from rest_framework.response import Response
from favorites.models import Favorite
from favorites.serializers import FavoriteSerializer


class FavoriteCreateListView(generics.ListCreateAPIView):
    queryset = Favorite.objects.all()
    serializer_class = FavoriteSerializer

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(qs, many=True)
        return Response({'status': 'success', 'data': serializer.data}, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response({'status': 'error', 'message': 'Erro.', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)
        return Response({'status': 'success', 'message': 'Roteiro adicionado aos favoritos com sucesso.', 'data': serializer.data}, status=status.HTTP_201_CREATED)


class FavoriteRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = Favorite.objects.all()
    serializer_class = FavoriteSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({'status': 'success', 'data': serializer.data}, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response({'status': 'error', 'message': 'Erro.', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'status': 'success', 'message': 'Roteiro removido dos favoritos.'}, status=status.HTTP_200_OK)
