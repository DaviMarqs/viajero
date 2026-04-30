from rest_framework import permissions, viewsets

from apps.audit.services import audit
from .models import TravelerDNAProfile, UserTripPreference
from .serializers import TravelerDNAProfileSerializer, TripPreferenceSerializer


class OwnedSingletonViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        audit(f"{self.basename}.created", actor=self.request.user, target=instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        audit(f"{self.basename}.updated", actor=self.request.user, target=instance)


class TravelerDNAProfileViewSet(OwnedSingletonViewSet):
    queryset = TravelerDNAProfile.objects.all()
    serializer_class = TravelerDNAProfileSerializer


class TripPreferenceViewSet(OwnedSingletonViewSet):
    queryset = UserTripPreference.objects.all()
    serializer_class = TripPreferenceSerializer
