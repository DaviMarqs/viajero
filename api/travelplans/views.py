from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from travelplans.models import TravelPlan
from travelplans.serializers import TravelPlanSerializer


class TravelPlanCreateListView(generics.ListCreateAPIView):
    queryset = TravelPlan.objects.all()
    serializer_class = TravelPlanSerializer
    permission_classes = [IsAuthenticated]

    # Garante que o usuário só pode criar viagens para ele mesmo
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

 #   def get_queryset(self):
 #       return TravelPlan.objects.filter(user=self.request.user)


class TravelPlanRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = TravelPlan.objects.all()
    serializer_class = TravelPlanSerializer
    permission_classes = [IsAuthenticated]

    # Garante que ele só pode editar/deletar se a viagem for dele
    def get_queryset(self):
        return TravelPlan.objects.filter(user=self.request.user)
