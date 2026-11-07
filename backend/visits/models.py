from django.conf import settings
from django.db import models

from leads.models import Lead
from properties.models import Unit


class Visit(models.Model):
    """A tour of a unit booked for a lead."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELED = "canceled", "Canceled"

    lead = models.ForeignKey(Lead, related_name="visits", on_delete=models.CASCADE)
    unit = models.ForeignKey(Unit, related_name="visits", on_delete=models.CASCADE)
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="visits",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.SCHEDULED, db_index=True
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F("starts_at")),
                name="visit_ends_after_start",
            )
        ]

    def __str__(self) -> str:
        return f"{self.lead} · {self.unit} · {self.starts_at:%Y-%m-%d %H:%M}"
