from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Destination(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=150)
    country = models.CharField(max_length=100)
    city = models.CharField(max_length=100, blank=True)
    summary = models.TextField(blank=True)
    hero_image_url = models.URLField(blank=True)
    timezone = models.CharField(max_length=64, blank=True)
    best_season = models.CharField(max_length=120, blank=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]


class DestinationCostProfile(models.Model):
    destination = models.OneToOneField(Destination, related_name="cost_profile", on_delete=models.CASCADE)
    currency_code = models.CharField(max_length=3, default="USD")
    daily_budget_low = models.DecimalField(max_digits=10, decimal_places=2)
    daily_budget_mid = models.DecimalField(max_digits=10, decimal_places=2)
    daily_budget_high = models.DecimalField(max_digits=10, decimal_places=2)
    source_url = models.URLField(blank=True)
    notes = models.TextField(blank=True)


class POITag(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(unique=True)


class PointOfInterest(models.Model):
    TYPE_CHOICES = (
        ("attraction", "Attraction"),
        ("restaurant", "Restaurant"),
        ("activity", "Activity"),
        ("lodging", "Lodging"),
    )

    destination = models.ForeignKey(Destination, related_name="pois", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    slug = models.SlugField()
    poi_type = models.CharField(max_length=24, choices=TYPE_CHOICES)
    summary = models.TextField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    opening_hours = models.CharField(max_length=255, blank=True)
    source_url = models.URLField(blank=True)
    price_level = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(5)])
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    estimated_visit_minutes = models.PositiveIntegerField(default=90)
    metadata = models.JSONField(default=dict, blank=True)
    tags = models.ManyToManyField(POITag, related_name="pois", blank=True)

    class Meta:
        unique_together = ("destination", "slug")
        ordering = ["name"]

