from rest_framework import permissions, viewsets

from .models import LLMJob, LLMModel, PromptTemplate
from .serializers import LLMJobSerializer, LLMModelSerializer, PromptTemplateSerializer


class LLMModelViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LLMModel.objects.select_related("provider").filter(is_active=True)
    serializer_class = LLMModelSerializer
    permission_classes = [permissions.IsAuthenticated]


class PromptTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PromptTemplate.objects.filter(is_active=True)
    serializer_class = PromptTemplateSerializer
    permission_classes = [permissions.IsAdminUser]


class LLMJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LLMJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LLMJob.objects.filter(user=self.request.user).select_related("destination", "itinerary", "llm_model").prefetch_related("logs")
