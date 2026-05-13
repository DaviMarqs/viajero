from django.db.models import Q
from rest_framework import permissions
from rest_framework.decorators import action

from apps.common.mixins import StandardModelViewSet
from .models import Destination, PointOfInterest
from .serializers import DestinationSerializer, PointOfInterestSerializer


SEARCH_LIMIT = 20


class DestinationViewSet(StandardModelViewSet):
    queryset = Destination.objects.prefetch_related("pois", "pois__tags").select_related("cost_profile")
    serializer_class = DestinationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ("country", "city")
    search_fields = ("name", "country", "city", "summary")
    ordering_fields = ("name", "average_rating", "created_at")

    def get_permissions(self):
        if self.action == "search":
            return [permissions.AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        country = request.query_params.get("country", "").strip()
        city = request.query_params.get("city", "").strip()

        queryset = self.get_queryset()
        if q:
            queryset = queryset.filter(
                Q(name__icontains=q)
                | Q(country__icontains=q)
                | Q(city__icontains=q)
                | Q(summary__icontains=q)
            )
        if country:
            queryset = queryset.filter(country__iexact=country)
        if city:
            queryset = queryset.filter(city__iexact=city)

        queryset = queryset.order_by("-average_rating", "name")[:SEARCH_LIMIT]
        data = self.get_serializer(queryset, many=True).data
        return self.success_response(data, message="Resultados da busca carregados com sucesso.")


class PointOfInterestViewSet(StandardModelViewSet):
    queryset = PointOfInterest.objects.select_related("destination").prefetch_related("tags")
    serializer_class = PointOfInterestSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ("destination", "poi_type", "tags__slug")
    search_fields = ("name", "summary", "address")
    ordering_fields = ("name", "rating", "estimated_visit_minutes")
