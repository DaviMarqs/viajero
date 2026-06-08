import logging

from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.decorators import action

from apps.ai.resolvers.destination_resolver import DestinationResolverService
from apps.ai.suggesters.destination_suggester import DestinationSuggestionService
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
        region = ""

        if q:
            resolved = self._resolve_query(q)
            if resolved is not None:
                if not resolved.is_valid_place():
                    audit(
                        "destination.search_rejected",
                        actor=request.user if request.user.is_authenticated else None,
                        metadata={"query": q, "confidence": resolved.confidence},
                    )
                    return self.error_response(
                        errors={"q": ["nao parece um destino de viagem valido"]},
                        message=(
                            "Nao reconhecemos esse termo como um destino de viagem. "
                            "Tente o nome de uma cidade, regiao ou pais."
                        ),
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
                q = resolved.name or q
                country = resolved.country or country
                city = resolved.city or city
                region = resolved.region

        results = self._local_search(q=q, country=country, city=city)

        discovered = False
        if q and not results.exists():
            try:
                destination = DestinationDiscoveryService().discover(
                    query=q, country=country, city=city, region=region, actor=request.user,
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

    @action(detail=False, methods=["post"], url_path="suggest", permission_classes=[permissions.IsAuthenticated])
    def suggest(self, request):
        """Sugere um destino para o usuario sem que ele digite nada.

        Usa o perfil/preferencias do usuario (via Groq) para escolher um
        destino e reaproveita a descoberta/local search para materializa-lo.
        """
        try:
            suggestion = DestinationSuggestionService().suggest(request.user)
        except Exception:
            logger.exception("Falha ao sugerir destino para user=%s", request.user.pk)
            suggestion = None

        if suggestion is None:
            return self.error_response(
                errors={"suggestion": ["nao foi possivel sugerir um destino"]},
                message=(
                    "Nao foi possivel gerar um destino agora. "
                    "Tente novamente em instantes ou complete suas preferencias."
                ),
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        results = list(self._local_search(q=suggestion.name, country=suggestion.country, city=suggestion.city))
        destination = results[0] if results else None

        if destination is None:
            try:
                destination = DestinationDiscoveryService().discover(
                    query=suggestion.name,
                    country=suggestion.country,
                    city=suggestion.city,
                    actor=request.user,
                )
            except Exception:
                logger.exception("Falha na descoberta do destino sugerido=%s", suggestion.name)
                destination = None

            if destination is not None:
                destination = self.get_queryset().filter(pk=destination.pk).first() or destination

        if destination is None:
            return self.error_response(
                errors={"suggestion": ["destino sugerido nao pode ser carregado"]},
                message=(
                    f"Sugerimos {suggestion.name}, mas nao conseguimos carregar os detalhes. "
                    "Tente novamente."
                ),
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        audit(
            "destination.suggested",
            actor=request.user,
            target=destination,
            metadata={
                "suggested_name": suggestion.name,
                "country": suggestion.country,
                "city": suggestion.city,
                "rationale": suggestion.rationale,
            },
        )

        data = self.get_serializer(destination).data
        return self.success_response(
            data,
            message=f"Destino sugerido com base no seu perfil: {destination.name}.",
        )

    def _resolve_query(self, q: str):
        try:
            return DestinationResolverService().resolve(q)
        except Exception:
            logger.exception("Resolver de destino falhou para query=%s", q)
            return None

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
