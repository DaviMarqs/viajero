from django.conf import settings
from django.db import models


class LLMProvider(models.Model):
    key = models.SlugField(unique=True)
    name = models.CharField(max_length=80)
    config = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)


class LLMModel(models.Model):
    provider = models.ForeignKey(LLMProvider, related_name="models", on_delete=models.CASCADE)
    key = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    context_window = models.PositiveIntegerField(default=16000)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)


class PromptTemplate(models.Model):
    key = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    template = models.TextField()
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)


class LLMJob(models.Model):
    STATUS_CHOICES = (
        ("queued", "Queued"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="llm_jobs", on_delete=models.CASCADE)
    itinerary = models.ForeignKey("itineraries.Itinerary", null=True, blank=True, related_name="llm_jobs", on_delete=models.SET_NULL)
    destination = models.ForeignKey("destinations.Destination", null=True, blank=True, related_name="llm_jobs", on_delete=models.SET_NULL)
    prompt_template = models.ForeignKey(PromptTemplate, null=True, blank=True, on_delete=models.SET_NULL)
    llm_model = models.ForeignKey(LLMModel, null=True, blank=True, on_delete=models.SET_NULL)
    job_type = models.CharField(max_length=40, default="itinerary_generation")
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="queued")
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class LLMJobLog(models.Model):
    llm_job = models.ForeignKey(LLMJob, related_name="logs", on_delete=models.CASCADE)
    level = models.CharField(max_length=16, default="info")
    message = models.TextField()
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

