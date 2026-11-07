from django.db import models


class Property(models.Model):
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=80, db_index=True)
    state = models.CharField(max_length=2)
    image_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "properties"

    def __str__(self) -> str:
        return self.name


class Unit(models.Model):
    class Status(models.TextChoices):
        VACANT = "vacant", "Vacant"
        NOTICE = "notice", "On notice"
        OCCUPIED = "occupied", "Occupied"

    property = models.ForeignKey(Property, related_name="units", on_delete=models.CASCADE)
    label = models.CharField(max_length=20)
    bedrooms = models.PositiveSmallIntegerField(default=1)
    bathrooms = models.DecimalField(max_digits=3, decimal_places=1, default=1)
    square_feet = models.PositiveIntegerField(default=650)
    rent = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.VACANT)
    available_from = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["property_id", "label"]
        constraints = [
            models.UniqueConstraint(fields=["property", "label"], name="unique_unit_label")
        ]

    def __str__(self) -> str:
        return f"{self.property.name} · {self.label}"


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
