from django.contrib.auth import get_user_model
from rest_framework import permissions
from rest_framework.decorators import action

from apps.audit.services import audit
from apps.common.mixins import StandardRetrieveUpdateViewSet
from .serializers import UserSerializer

User = get_user_model()


class UserViewSet(StandardRetrieveUpdateViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action == "me":
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=["get", "patch"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        if request.method.lower() == "patch":
            serializer = self.get_serializer(request.user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            audit("user.profile_updated", actor=request.user, target=request.user, metadata=request.data)
            return self.success_response(serializer.data, message="Usuario atualizado com sucesso.")
        return self.success_response(self.get_serializer(request.user).data, message="Usuario carregado com sucesso.")
