from rest_framework import generics
from viajero.models import TravelPlan, Favorite
from viajero.serializers import TravelPlanSerializer, FavoriteSerializer


class TravelPlanCreateListView(generics.ListCreateAPIView):
    queryset = TravelPlan.objects.all()
    serializer_class = TravelPlanSerializer


class TravelPlanRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = TravelPlan.objects.all()
    serializer_class = TravelPlanSerializer


class FavoriteCreateListView(generics.ListCreateAPIView):
    queryset = Favorite.objects.all()
    serializer_class = FavoriteSerializer


class FavoriteRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = Favorite.objects.all()
    serializer_class = FavoriteSerializer
