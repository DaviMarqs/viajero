from rest_framework import serializers
from user_preferences.models import UserPreference


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = '__all__'