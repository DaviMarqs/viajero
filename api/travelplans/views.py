from rest_framework import generics
from travelplans.models import TravelPlan
from travelplans.serializers import TravelPlanSerializer


class TravelPlanCreateListView(generics.ListCreateAPIView):
    queryset = TravelPlan.objects.all()
    serializer_class = TravelPlanSerializer


class TravelPlanRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = TravelPlan.objects.all()
    serializer_class = TravelPlanSerializer
