from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "display_name",
            "first_name",
            "last_name",
            "avatar_url",
            "home_airport",
            "preferred_currency",
            "is_profile_complete",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
