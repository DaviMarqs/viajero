from django.contrib.auth import authenticate, get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.services import audit
from apps.users.serializers import UserSerializer
from .serializers import LoginSerializer, RegisterSerializer

User = get_user_model()


def build_auth_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }


class AuthViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        if self.action in {"register", "create_account"}:
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
        return Response(build_auth_payload(user), status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="create-account")
    def create_account(self, request):
        return self.register(request)

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
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)

        audit("user.logged_in", actor=authenticated_user, target=authenticated_user)
        return Response(build_auth_payload(authenticated_user), status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="logout")
    def logout(self, request):
        audit("user.logged_out", actor=request.user, target=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
