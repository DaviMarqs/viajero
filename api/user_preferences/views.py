from rest_framework import viewsets
from .models import UserPreference
from .serializers import UserPreferenceSerializer


class UserPreferenceViewSet(viewsets.ModelViewSet):
    queryset = UserPreference.objects.all()
    serializer_class = UserPreferenceSerializer