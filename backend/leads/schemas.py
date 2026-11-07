from datetime import date, datetime
from decimal import Decimal

from ninja import Field, Schema

from leads.models import Lead, Message


class LeadFilters(Schema):
    status: Lead.Status | None = None
    search: str | None = None
    limit: int = 1000


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
    unit_id: int | None
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
