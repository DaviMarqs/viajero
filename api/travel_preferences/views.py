from django.shortcuts import render
from rest_framework import viewsets
from travel_preferences.models import TravelPreference
from travel_preferences.serializers import TravelPreferenceSerializer


class TravelPreferenceViewSet(viewsets.ModelViewSet):
    queryset = TravelPreference.objects.all()
    serializer_class = TravelPreferenceSerializer