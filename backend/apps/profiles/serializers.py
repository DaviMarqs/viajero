from rest_framework import serializers

from .models import TravelerDNAProfile, UserTripPreference


class TravelerDNAProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelerDNAProfile
        fields = "__all__"
        read_only_fields = ("user",)


class TripPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserTripPreference
        fields = "__all__"
        read_only_fields = ("user",)

    def validate(self, attrs):
        budget_min = attrs.get("budget_min", getattr(self.instance, "budget_min", None))
        budget_max = attrs.get("budget_max", getattr(self.instance, "budget_max", None))
        if budget_min is not None and budget_max is not None and budget_min > budget_max:
            raise serializers.ValidationError("budget_min cannot exceed budget_max")
        return attrs

