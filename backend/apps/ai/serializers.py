from rest_framework import serializers

from .models import LLMJob, LLMJobLog, LLMModel, LLMProvider, PromptTemplate


class LLMProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = LLMProvider
        fields = "__all__"


class LLMModelSerializer(serializers.ModelSerializer):
    provider = LLMProviderSerializer(read_only=True)

    class Meta:
        model = LLMModel
        fields = "__all__"


class PromptTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptTemplate
        fields = "__all__"


class LLMJobLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = LLMJobLog
        fields = "__all__"


class LLMJobSerializer(serializers.ModelSerializer):
    logs = LLMJobLogSerializer(many=True, read_only=True)

    class Meta:
        model = LLMJob
        fields = "__all__"
        read_only_fields = ("user", "status", "response_payload", "error_message")
