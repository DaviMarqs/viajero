from rest_framework import serializers

from .models import Destination, DestinationCostProfile, POITag, PointOfInterest


class POITagSerializer(serializers.ModelSerializer):
    class Meta:
        model = POITag
        fields = ("id", "name", "slug")


class PointOfInterestSerializer(serializers.ModelSerializer):
    tags = POITagSerializer(many=True, read_only=True)

    class Meta:
        model = PointOfInterest
        fields = "__all__"


class DestinationCostProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DestinationCostProfile
        fields = "__all__"


class DestinationSerializer(serializers.ModelSerializer):
    cost_profile = DestinationCostProfileSerializer(read_only=True)
    pois = PointOfInterestSerializer(many=True, read_only=True)

    class Meta:
        model = Destination
        fields = "__all__"

