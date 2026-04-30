from rest_framework import serializers
from travel_preferences.models import TravelPreference
from rest_framework.validators import UniqueTogetherValidator


class TravelPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPreference
        fields = '__all__'