from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.authentication.views import AuthViewSet
from apps.ai.views import LLMJobViewSet, LLMModelViewSet, PromptTemplateViewSet
from apps.audit.views import AuditLogViewSet
from apps.destinations.views import DestinationViewSet, PointOfInterestViewSet
from apps.integrations.views import FirecrawlIngestionView
from apps.itineraries.views import (
    FavoriteItineraryViewSet,
    ItineraryViewSet,
    ReviewViewSet,
    SharedItineraryLinkViewSet,
)
from apps.profiles.views import TravelerDNAProfileViewSet, TripPreferenceViewSet
from apps.users.views import UserViewSet

router = DefaultRouter()
router.register("auth", AuthViewSet, basename="auth")
router.register("users", UserViewSet, basename="users")
router.register("destinations", DestinationViewSet, basename="destinations")
router.register("pois", PointOfInterestViewSet, basename="pois")
router.register("traveler-dna", TravelerDNAProfileViewSet, basename="traveler-dna")
router.register("trip-preferences", TripPreferenceViewSet, basename="trip-preferences")
router.register("itineraries", ItineraryViewSet, basename="itineraries")
router.register("favorites", FavoriteItineraryViewSet, basename="favorites")
router.register("reviews", ReviewViewSet, basename="reviews")
router.register("shared-links", SharedItineraryLinkViewSet, basename="shared-links")
router.register("llm-models", LLMModelViewSet, basename="llm-models")
router.register("llm-jobs", LLMJobViewSet, basename="llm-jobs")
router.register("prompt-templates", PromptTemplateViewSet, basename="prompt-templates")
router.register("audit-logs", AuditLogViewSet, basename="audit-logs")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/firecrawl/ingest/", FirecrawlIngestionView.as_view(), name="firecrawl-ingest"),
]
