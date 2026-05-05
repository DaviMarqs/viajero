from rest_framework import serializers
from user_preferences.models import UserPreference


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = [
            'id',
            'user',
            'traveler_type',
            'comfort_level',
            'companionship',
            'travel_pace',
            'travel_experience'
        ]
        read_only_fields = ['user']
    