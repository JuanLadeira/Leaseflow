from datetime import date, datetime
from decimal import Decimal

from ninja import Field, Schema

from leasing.models import Lead, Message, Unit


class Page[T](Schema):
    items: list[T]
    count: int
    page: int
    page_size: int


# --- Properties & units ---------------------------------------------------------


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


# --- Leads ------------------------------------------------------------------------


class LeadUnitOut(Schema):
    id: int
    label: str
    property_id: int
    property_name: str
    rent: Decimal


class LeadListOut(Schema):
    id: int
    full_name: str
    email: str
    status: Lead.Status
    source: Lead.Source
    unit_label: str | None
    property_name: str | None
    last_message_preview: str
    last_activity_at: datetime


class MessageOut(Schema):
    id: int
    direction: Message.Direction
    body: str
    ai_generated: bool
    created_at: datetime


class LeadDetailOut(Schema):
    id: int
    full_name: str
    email: str
    phone: str
    status: Lead.Status
    source: Lead.Source
    desired_move_in: date | None
    budget: Decimal | None
    created_at: datetime
    last_activity_at: datetime
    unit: LeadUnitOut | None
    messages: list[MessageOut]


class LeadStatusIn(Schema):
    status: Lead.Status


class MessageIn(Schema):
    body: str = Field(min_length=1, max_length=4000)
    ai_generated: bool = False


# --- Dashboard ---------------------------------------------------------------------


class DashboardOut(Schema):
    total_units: int
    vacant_units: int
    occupancy_rate: float
    leads_by_status: dict[str, int]
    conversion_rate: float
