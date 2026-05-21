import logging

from django.db.models import Q
from rest_framework import permissions
from rest_framework.decorators import action

from apps.audit.services import audit
from apps.common.mixins import StandardModelViewSet
from .models import Destination, PointOfInterest
from .serializers import DestinationSerializer, PointOfInterestSerializer
from .services import DestinationDiscoveryService


SEARCH_LIMIT = 20

logger = logging.getLogger(__name__)


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

        results = self._local_search(q=q, country=country, city=city)

        discovered = False
        if q and not results.exists():
            try:
                destination = DestinationDiscoveryService().discover(
                    query=q, country=country, city=city, actor=request.user,
                )
            except Exception:
                logger.exception("Falha na descoberta de destino para query=%s", q)
                destination = None

            if destination is not None:
                discovered = True
                audit(
                    "destination.discovered",
                    actor=request.user if request.user.is_authenticated else None,
                    target=destination,
                    metadata={
                        "query": q,
                        "country": country,
                        "city": city,
                        "sources": (destination.metadata or {}).get("sources") or {},
                    },
                )
                refreshed = list(self._local_search(q=q, country=country, city=city))
                if all(item.pk != destination.pk for item in refreshed):
                    enriched = self.get_queryset().filter(pk=destination.pk).first()
                    if enriched is not None:
                        refreshed.insert(0, enriched)
                results = refreshed

        data = self.get_serializer(results, many=True).data
        message = (
            "Resultados carregados (destino enriquecido)."
            if discovered
            else "Resultados da busca carregados com sucesso."
        )
        return self.success_response(data, message=message)

    def _local_search(self, *, q: str, country: str, city: str):
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
        return queryset.order_by("-average_rating", "name")[:SEARCH_LIMIT]


class PointOfInterestViewSet(StandardModelViewSet):
    queryset = PointOfInterest.objects.select_related("destination").prefetch_related("tags")
    serializer_class = PointOfInterestSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ("destination", "poi_type", "tags__slug")
    search_fields = ("name", "summary", "address")
    ordering_fields = ("name", "rating", "estimated_visit_minutes")
