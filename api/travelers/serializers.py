from rest_framework import serializers
from .models import Traveler
from datetime import date


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

    def validate_date_of_birth(self, value):
        if value > date.today():
            raise serializers.ValidationError("Data de nascimento não pode ser no futuro.")
        return value

    def validate_document_id(self, value):
        if len(value) < 5:
            raise serializers.ValidationError("Documento inválido.")
        return value