from rest_framework import serializers
from travel_preferences.models import TravelPreference

class TravelPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPreference
        fields = '__all__'