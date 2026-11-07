from datetime import date
from decimal import Decimal

from ninja import Field, Schema

from properties.models import Unit


class PropertyFilters(Schema):
    search: str | None = None
    page: int = 1
    page_size: int = 12


class UnitOut(Schema):
    id: int
    property_id: int
    label: str
    bedrooms: int
    bathrooms: Decimal
    square_feet: int
    rent: Decimal
    status: Unit.Status
    available_from: date | None


class UnitIn(Schema):
    label: str = Field(min_length=1, max_length=20)
    bedrooms: int = Field(ge=0, le=10)
    bathrooms: Decimal = Field(ge=0, le=10)
    square_feet: int = Field(gt=0)
    rent: Decimal = Field(gt=0)
    status: Unit.Status = Unit.Status.VACANT
    available_from: date | None = None


class PropertyOut(Schema):
    id: int
    name: str
    address: str
    city: str
    state: str
    image_url: str
    unit_count: int
    vacant_count: int
    occupancy_rate: float


class PropertyDetailOut(PropertyOut):
    units: list[UnitOut]


class PropertyIn(Schema):
    name: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=3, max_length=255)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=2)
    image_url: str = ""
