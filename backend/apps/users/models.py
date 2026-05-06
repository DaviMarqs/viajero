import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120, blank=True)
    avatar_url = models.URLField(blank=True)
    home_airport = models.CharField(max_length=12, blank=True)
    preferred_currency = models.CharField(max_length=3, default="BRL")
    is_profile_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self) -> str:
        return self.email


class RefreshToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="refresh_tokens")
    token = models.CharField(max_length=255, unique=True, default=uuid.uuid4)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

