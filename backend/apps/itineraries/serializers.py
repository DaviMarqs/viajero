from rest_framework import serializers

from .models import FavoriteItinerary, Itinerary, ItineraryDailyEvent, ItineraryDay, Review, SharedItineraryLink


class ItineraryDailyEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItineraryDailyEvent
        fields = "__all__"


class ItineraryDaySerializer(serializers.ModelSerializer):
    events = ItineraryDailyEventSerializer(many=True, read_only=True)

    class Meta:
        model = ItineraryDay
        fields = "__all__"


class ItinerarySerializer(serializers.ModelSerializer):
    days = ItineraryDaySerializer(many=True, read_only=True)

    class Meta:
        model = Itinerary
        fields = "__all__"
        read_only_fields = ("user", "generation_status", "generation_context", "metadata")
        extra_kwargs = {
            "duration_days": {"required": False},
            "budget_total": {"required": False},
            "title": {"required": False},
        }

    def validate_duration_days(self, value):
        if value < 1 or value > 60:
            raise serializers.ValidationError("Trip duration must be between 1 and 60 days.")
        return value


class FavoriteItinerarySerializer(serializers.ModelSerializer):
    class Meta:
        model = FavoriteItinerary
        fields = "__all__"
        read_only_fields = ("user",)


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = "__all__"
        read_only_fields = ("user",)


class SharedItineraryLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SharedItineraryLink
        fields = "__all__"
        read_only_fields = ("created_by", "token")
