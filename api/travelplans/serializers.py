from rest_framework import serializers
from travelplans.models import TravelPlan


class TravelPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPlan
        fields = [
            'id',
            'user',
            'titulo',
            'destino_principal',
            'dados',
            'status',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['user']

