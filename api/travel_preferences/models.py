from django.db import models
from django.conf import settings

class TravelPreference(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    duration_days = models.IntegerField()
    budget = models.CharField(max_length=20)
    climate = models.CharField(max_length=20)
    interests = models.JSONField()
    restrictions = models.JSONField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)