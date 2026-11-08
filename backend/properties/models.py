from django.conf import settings
from django.db import models


class Property(models.Model):
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=80, db_index=True)
    state = models.CharField(max_length=2)
    image_url = models.URLField(blank=True)
    # Row-level access: a user only sees the properties they manage (see accounts.permissions).
    managers = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="managed_properties", blank=True
    )
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
