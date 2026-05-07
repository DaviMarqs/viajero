from django.db.models import Avg, Count
from rest_framework import permissions, status
from rest_framework.decorators import action

from apps.ai.services import ItineraryGenerationService
from apps.audit.services import audit
from apps.common.mixins import StandardModelViewSet
from .models import FavoriteItinerary, Itinerary, Review, ReviewStat, SharedItineraryLink
from .serializers import FavoriteItinerarySerializer, ItinerarySerializer, ReviewSerializer, SharedItineraryLinkSerializer


class ItineraryViewSet(StandardModelViewSet):
    serializer_class = ItinerarySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ("destination", "generation_status")
    search_fields = ("title", "summary")
    ordering_fields = ("created_at", "budget_total", "duration_days")

    def get_queryset(self):
        return Itinerary.objects.filter(user=self.request.user).select_related("destination").prefetch_related("days__events")

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
