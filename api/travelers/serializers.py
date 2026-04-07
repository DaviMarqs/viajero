from rest_framework import serializers
from .models import Traveler


class TravelerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Traveler
        fields = [
            'id',
            'user',
            'first_name',
            'last_name',
            'phone_number',
            'date_of_birth',
            'document_id'
        ]
        read_only_fields = ['user']