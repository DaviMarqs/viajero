from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Traveler
from .serializers import TravelerSerializer


class TravelerCreateListView(generics.ListCreateAPIView):
    queryset = Traveler.objects.all()
    serializer_class = TravelerSerializer
    # permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TravelerRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = Traveler.objects.all()
    serializer_class = TravelerSerializer
    permission_classes = [IsAuthenticated]