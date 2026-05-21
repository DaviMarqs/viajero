from rest_framework import permissions, status
from rest_framework.decorators import action

from apps.audit.services import audit
from apps.common.mixins import StandardModelViewSet
from .models import TravelerDNAProfile, UserTripPreference
from .serializers import TravelerDNAProfileSerializer, TripPreferenceSerializer


class OwnedSingletonViewSet(StandardModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def get_singleton(self):
        return self.get_queryset().first()

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        audit(f"{self.basename}.created", actor=self.request.user, target=instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        audit(f"{self.basename}.updated", actor=self.request.user, target=instance)

    @action(detail=False, methods=["get", "put", "patch"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        instance = self.get_singleton()

        if request.method.lower() == "get":
            data = self.get_serializer(instance).data if instance else None
            return self.success_response(data, message="Registro carregado com sucesso.")

        partial = request.method.lower() == "patch"
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        if instance is None:
            instance = serializer.save(user=request.user)
            audit(f"{self.basename}.created", actor=request.user, target=instance)
            return self.success_response(
                self.get_serializer(instance).data,
                message="Registro criado com sucesso.",
                status_code=status.HTTP_201_CREATED,
            )

        instance = serializer.save()
        audit(f"{self.basename}.updated", actor=request.user, target=instance)
        return self.success_response(self.get_serializer(instance).data, message="Registro atualizado com sucesso.")


class TravelerDNAProfileViewSet(OwnedSingletonViewSet):
    queryset = TravelerDNAProfile.objects.all()
    serializer_class = TravelerDNAProfileSerializer


class TripPreferenceViewSet(OwnedSingletonViewSet):
    queryset = UserTripPreference.objects.all()
    serializer_class = TripPreferenceSerializer
