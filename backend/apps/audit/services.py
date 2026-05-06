from .models import AuditLog


def audit(event_type: str, actor=None, target=None, metadata=None):
    AuditLog.objects.create(
        event_type=event_type,
        actor=actor,
        content_type=target.__class__.__name__ if target else "",
        object_id=str(getattr(target, "pk", "")) if target else "",
        metadata=metadata or {},
    )

