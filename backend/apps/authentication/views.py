from django.contrib.auth import authenticate, get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.services import audit
from apps.common.mixins import StandardResponseMixin
from apps.users.serializers import UserSerializer
from .serializers import LoginSerializer, RegisterSerializer

from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
}

User = get_user_model()


def build_auth_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }


class AuthViewSet(StandardResponseMixin, viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]
    success_messages = {
        **StandardResponseMixin.success_messages,
        "register": "Usuario cadastrado com sucesso.",
        "login": "Autenticacao realizada com sucesso.",
        "logout": "Sessao encerrada com sucesso.",
    }

    def get_serializer_class(self):
        if self.action == "register":
            return RegisterSerializer
        if self.action == "login":
            return LoginSerializer
        return super().get_serializer_class()

    @action(detail=False, methods=["post"], url_path="register")
    def register(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        audit("user.registered", actor=user, target=user)
        return self.success_response(
            build_auth_payload(user),
            message=self.get_success_message("register"),
            status_code=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = User.objects.filter(email__iexact=email).first()
        authenticated_user = None
        if user:
            authenticated_user = authenticate(request, username=user.email, password=password)

        if not authenticated_user:
            return self.error_response(
                {"detail": "Invalid credentials."},
                message="Credenciais invalidas.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        audit("user.logged_in", actor=authenticated_user, target=authenticated_user)
        return self.success_response(
            build_auth_payload(authenticated_user),
            message=self.get_success_message("login"),
            status_code=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="logout")
    def logout(self, request):
        audit("user.logged_out", actor=request.user, target=request.user)
        return self.success_response(
            None,
            message=self.get_success_message("logout"),
            status_code=status.HTTP_200_OK,
        )
