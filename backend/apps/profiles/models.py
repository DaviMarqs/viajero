from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class TravelerDNAProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="traveler_dna_profile", on_delete=models.CASCADE)
    travel_style = models.CharField(max_length=80)
    pace = models.CharField(max_length=40)
    comfort_level = models.CharField(max_length=40)
    social_energy = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    adventure_level = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    food_focus = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    cultural_interest = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    nature_interest = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    nightlife_interest = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class UserTripPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="trip_preference", on_delete=models.CASCADE)
    budget_min = models.DecimalField(max_digits=10, decimal_places=2)
    budget_max = models.DecimalField(max_digits=10, decimal_places=2)
    currency_code = models.CharField(max_length=3, default="BRL")
    preferred_trip_length_days = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(60)])
    travel_month = models.CharField(max_length=20, blank=True)
    hotel_level = models.CharField(max_length=40, blank=True)
    transportation_style = models.CharField(max_length=40, blank=True)
    dietary_preferences = models.JSONField(default=list, blank=True)
    accessibility_needs = models.JSONField(default=list, blank=True)
    interests = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.budget_min > self.budget_max:
            from django.core.exceptions import ValidationError

            raise ValidationError("budget_min cannot exceed budget_max")

