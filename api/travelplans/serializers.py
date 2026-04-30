from rest_framework import serializers
from travelplans.models import TravelPlan


class TravelPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPlan
        fields = '__all__'
        read_only_fields = ['user']
