from django.db import models
from django.conf import settings

class UserPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    traveler_type = models.CharField(max_length=20)
    comfort_level = models.CharField(max_length=20)
    companionship = models.CharField(max_length=20)
    travel_pace = models.CharField(max_length=20)
    travel_experience = models.CharField(max_length=20)