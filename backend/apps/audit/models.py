from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    event_type = models.CharField(max_length=80)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="audit_events", on_delete=models.SET_NULL)
    content_type = models.CharField(max_length=80, blank=True)
    object_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

