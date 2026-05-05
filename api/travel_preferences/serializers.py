from rest_framework import serializers
from travel_preferences.models import TravelPreference
from rest_framework.validators import UniqueTogetherValidator


class TravelPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPreference
        fields = [
            'id',
            'user',
            'duration_days',
            'budget',
            'climate',
            'interests',
            'restrictions',
            'created_at'
        ]
        read_only_fields = ['user']

    def validate_duration_days(self, value):
        if value < 1:
            raise serializers.ValidationError("O tempo mínimo de duração da viagem deve ser de 1 (um) dia.")
        return value