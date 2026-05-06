import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Itinerary(models.Model):
    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("generating", "Generating"),
        ("ready", "Ready"),
        ("failed", "Failed"),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="itineraries", on_delete=models.CASCADE)
    destination = models.ForeignKey("destinations.Destination", related_name="itineraries", on_delete=models.CASCADE)
    title = models.CharField(max_length=160)
    summary = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    duration_days = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(60)])
    budget_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency_code = models.CharField(max_length=3, default="BRL")
    generation_status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="draft")
    generation_context = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ItineraryDay(models.Model):
    itinerary = models.ForeignKey(Itinerary, related_name="days", on_delete=models.CASCADE)
    day_number = models.PositiveIntegerField()
    title = models.CharField(max_length=120)
    summary = models.TextField(blank=True)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        unique_together = ("itinerary", "day_number")
        ordering = ["day_number"]


class ItineraryDailyEvent(models.Model):
    itinerary_day = models.ForeignKey(ItineraryDay, related_name="events", on_delete=models.CASCADE)
    poi = models.ForeignKey("destinations.PointOfInterest", null=True, blank=True, related_name="daily_events", on_delete=models.SET_NULL)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    order_index = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order_index", "start_time"]


class FavoriteItinerary(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="favorite_itineraries", on_delete=models.CASCADE)
    itinerary = models.ForeignKey(Itinerary, related_name="favorites", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "itinerary")


class Review(models.Model):
    itinerary = models.ForeignKey(Itinerary, related_name="reviews", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="reviews", on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=120, blank=True)
    body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("itinerary", "user")


class ReviewStat(models.Model):
    itinerary = models.OneToOneField(Itinerary, related_name="review_stats", on_delete=models.CASCADE)
    review_count = models.PositiveIntegerField(default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)


class SharedItineraryLink(models.Model):
    itinerary = models.ForeignKey(Itinerary, related_name="shared_links", on_delete=models.CASCADE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="shared_itineraries", on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

