from rest_framework import generics
from travelplans.models import TravelPlan
from rest_framework.permissions import IsAuthenticated
from travelplans.serializers import TravelPlanSerializer
from helpers.responses import api_response


class TravelPlanCreateListView(generics.ListCreateAPIView):
    serializer_class = TravelPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TravelPlan.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        travel_plans = self.get_queryset()
        serializer = self.get_serializer(travel_plans, many=True)

        return api_response(
            status_bool=True,
            message="Lista de roteiros retornada com sucesso",
            data=serializer.data,
            http_status=200
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save(user=request.user)

            return api_response(
                status_bool=True,
                message="Roteiro criado com sucesso.",
                data=serializer.data,
                http_status=201
            )

        return api_response(
            status_bool=False,
            message="Erro ao criar roteiro.",
            errors=serializer.errors,
            http_status=400
        )
    
class TravelPlanRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TravelPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TravelPlan.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        travel_plan = self.get_object()
        serializer = self.get_serializer(travel_plan)

        return api_response(
            status_bool=True,
            message="Roteiro recuperado com sucesso.",
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        travel_plan = self.get_object()
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(travel_plan, data=request.data, partial=partial)

        if serializer.is_valid():
            serializer.save()

            return api_response(
                status_bool=True,
                message="Roteiro atualizado com sucesso.",
                data=serializer.data
            )

        return api_response(
            status_bool=False,
            message="Erro ao atualizar roteiro.",
            errors=serializer.errors,
            http_status=400
        )

    def destroy(self, request, *args, **kwargs):
        travel_plan = self.get_object()
        travel_plan.delete()

        return api_response(
            status_bool=True,
            message="Roteiro removido com sucesso.",
            http_status=200  
        )