from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.users.serializers import UserSerializer

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    username = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("email", "username", "password", "display_name", "first_name", "last_name")

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_username(self, value: str) -> str:
        return value.strip()

    def create(self, validated_data):
        password = validated_data.pop("password")
        email = validated_data["email"]
        username = validated_data.pop("username", "")

        if not username:
            base_username = email.split("@")[0][:150] or "viajero"
            candidate = base_username
            suffix = 1
            while User.objects.filter(username__iexact=candidate).exists():
                suffix += 1
                candidate = f"{base_username[: max(1, 150 - len(str(suffix)) - 1)]}-{suffix}"
            username = candidate

        user = User(username=username, **validated_data)
        if not user.display_name:
            full_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip()
            user.display_name = full_name or username
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class AuthResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()
