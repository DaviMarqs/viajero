from rest_framework import permissions

from apps.common.mixins import StandardModelViewSet
from .models import Destination, PointOfInterest
from .serializers import DestinationSerializer, PointOfInterestSerializer


class DestinationViewSet(StandardModelViewSet):
    queryset = Destination.objects.prefetch_related("pois", "pois__tags").select_related("cost_profile")
    serializer_class = DestinationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ("country", "city")
    search_fields = ("name", "country", "city", "summary")
    ordering_fields = ("name", "average_rating", "created_at")


class PointOfInterestViewSet(StandardModelViewSet):
    queryset = PointOfInterest.objects.select_related("destination").prefetch_related("tags")
    serializer_class = PointOfInterestSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ("destination", "poi_type", "tags__slug")
    search_fields = ("name", "summary", "address")
    ordering_fields = ("name", "rating", "estimated_visit_minutes")
