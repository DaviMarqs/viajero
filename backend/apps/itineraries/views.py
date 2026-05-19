from django.db.models import Avg, Count, F
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import action

from apps.ai.services import ItineraryGenerationService
from apps.audit.services import audit
from apps.common.mixins import StandardModelViewSet
from .models import FavoriteItinerary, Itinerary, ItineraryDay, Review, ReviewStat, SharedItineraryLink
from .serializers import (
    FavoriteItinerarySerializer,
    ItineraryDaySerializer,
    ItinerarySerializer,
    ReviewSerializer,
    SharedItineraryLinkSerializer,
)


TOP_RATED_LIMIT = 10
TEMPLATES_LIMIT = 10


class ItineraryViewSet(StandardModelViewSet):
    serializer_class = ItinerarySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ("destination", "generation_status")
    search_fields = ("title", "summary")
    ordering_fields = ("created_at", "budget_total", "duration_days")

    def get_queryset(self):
        if self.action in ("templates", "top_rated"):
            return Itinerary.objects.select_related("destination").prefetch_related("days__events")
        return Itinerary.objects.filter(user=self.request.user).select_related("destination").prefetch_related("days__events")

    def get_permissions(self):
        if self.action in ("templates", "top_rated"):
            return [permissions.AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        itinerary = serializer.save(user=self.request.user)
        audit("itinerary.created", actor=self.request.user, target=itinerary)

    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        itinerary = self.get_object()
        itinerary.generation_status = "generating"
        itinerary.save(update_fields=["generation_status", "updated_at"])
        service = ItineraryGenerationService()
        job = service.create_job(itinerary=itinerary, user=request.user)
        service.run_job(job)
        audit("itinerary.generated", actor=request.user, target=itinerary, metadata={"job_id": job.id})
        return self.success_response(
            self.get_serializer(itinerary).data,
            message="Geracao de itinerario iniciada.",
            status_code=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["get"], url_path="templates")
    def templates(self, request):
        queryset = (
            Itinerary.objects.filter(metadata__is_template=True, generation_status="ready")
            .select_related("destination")
            .prefetch_related("days__events")
            .order_by("-updated_at")[:TEMPLATES_LIMIT]
        )
        data = self.get_serializer(queryset, many=True).data
        return self.success_response(data, message="Templates de roteiros carregados com sucesso.")

    @action(detail=True, methods=["get"], url_path="days")
    def days(self, request, pk=None):
        itinerary = self.get_object()
        queryset = itinerary.days.prefetch_related("events", "events__poi").order_by("day_number")
        data = ItineraryDaySerializer(queryset, many=True).data
        return self.success_response(data, message="Programacao do roteiro carregada com sucesso.")

    @action(detail=True, methods=["get"], url_path=r"days/(?P<day_number>\d+)")
    def day_detail(self, request, pk=None, day_number=None):
        itinerary = self.get_object()
        day = get_object_or_404(
            ItineraryDay.objects.prefetch_related("events", "events__poi"),
            itinerary=itinerary,
            day_number=day_number,
        )
        data = ItineraryDaySerializer(day).data
        return self.success_response(data, message="Programacao do dia carregada com sucesso.")

    @action(detail=False, methods=["get"], url_path="top-rated")
    def top_rated(self, request):
        queryset = (
            Itinerary.objects.filter(generation_status="ready", review_stats__review_count__gt=0)
            .select_related("destination", "review_stats")
            .prefetch_related("days__events")
            .annotate(
                _avg_rating=F("review_stats__average_rating"),
                _review_count=F("review_stats__review_count"),
            )
            .order_by("-_avg_rating", "-_review_count")[:TOP_RATED_LIMIT]
        )
        data = self.get_serializer(queryset, many=True).data
        return self.success_response(data, message="Ranking de roteiros mais bem avaliados carregado com sucesso.")


class FavoriteItineraryViewSet(StandardModelViewSet):
    serializer_class = FavoriteItinerarySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FavoriteItinerary.objects.filter(user=self.request.user).select_related("itinerary", "itinerary__destination")

    def perform_create(self, serializer):
        favorite = serializer.save(user=self.request.user)
        audit("itinerary.favorited", actor=self.request.user, target=favorite.itinerary)


class ReviewViewSet(StandardModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    queryset = Review.objects.select_related("itinerary", "user")
    filterset_fields = ("itinerary", "rating")
    ordering_fields = ("created_at", "rating")

    def perform_create(self, serializer):
        review = serializer.save(user=self.request.user)
        stats = Review.objects.filter(itinerary=review.itinerary).aggregate(review_count=Count("id"), average_rating=Avg("rating"))
        ReviewStat.objects.update_or_create(
            itinerary=review.itinerary,
            defaults={"review_count": stats["review_count"] or 0, "average_rating": stats["average_rating"] or 0},
        )
        audit("review.created", actor=self.request.user, target=review.itinerary, metadata={"rating": review.rating})


class SharedItineraryLinkViewSet(StandardModelViewSet):
    serializer_class = SharedItineraryLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SharedItineraryLink.objects.filter(created_by=self.request.user).select_related("itinerary")

    def perform_create(self, serializer):
        shared = serializer.save(created_by=self.request.user)
        audit("itinerary.shared", actor=self.request.user, target=shared.itinerary, metadata={"token": str(shared.token)})
