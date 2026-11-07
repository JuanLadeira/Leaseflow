from django.db import models

from properties.models import Unit


class Lead(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        TOUR_SCHEDULED = "tour_scheduled", "Tour scheduled"
        APPLIED = "applied", "Applied"
        WON = "won", "Won"
        LOST = "lost", "Lost"

    class Source(models.TextChoices):
        WEBSITE = "website", "Website"
        ZILLOW = "zillow", "Zillow"
        APARTMENTS_COM = "apartments_com", "Apartments.com"
        REFERRAL = "referral", "Referral"
        WALK_IN = "walk_in", "Walk-in"

    full_name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    unit = models.ForeignKey(
        Unit, related_name="leads", null=True, blank=True, on_delete=models.SET_NULL
    )
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.WEBSITE)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW, db_index=True
    )
    desired_move_in = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-last_activity_at"]

    def __str__(self) -> str:
        return self.full_name


class Message(models.Model):
    class Direction(models.TextChoices):
        INBOUND = "inbound", "From prospect"
        OUTBOUND = "outbound", "From agent"

    lead = models.ForeignKey(Lead, related_name="messages", on_delete=models.CASCADE)
    direction = models.CharField(max_length=10, choices=Direction.choices)
    body = models.TextField()
    ai_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"{self.direction}: {self.body[:40]}"
