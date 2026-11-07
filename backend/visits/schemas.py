from datetime import datetime, timedelta

from ninja import Field, Schema
from pydantic import model_validator

from visits.models import Visit

MAX_DURATION = timedelta(hours=2)


class VisitFilters(Schema):
    start: datetime | None = None
    end: datetime | None = None
    unit_id: int | None = None
    lead_id: int | None = None
    include_canceled: bool = False


class VisitIn(Schema):
    lead_id: int
    unit_id: int | None = Field(None, description="Defaults to the lead's unit of interest.")
    starts_at: datetime
    ends_at: datetime
    notes: str = Field("", max_length=1000)

    @model_validator(mode="after")
    def check_range(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Times must include a UTC offset.")
        if self.ends_at <= self.starts_at:
            raise ValueError("The visit must end after it starts.")
        if self.ends_at - self.starts_at > MAX_DURATION:
            raise ValueError("A visit can last at most 2 hours.")
        return self


class VisitStatusIn(Schema):
    status: Visit.Status


class VisitOut(Schema):
    id: int
    lead_id: int
    lead_name: str
    unit_id: int
    unit_label: str
    property_id: int
    property_name: str
    agent_id: int | None
    agent_name: str | None
    starts_at: datetime
    ends_at: datetime
    status: Visit.Status
    notes: str


class ConflictOut(Schema):
    detail: str
    conflict: VisitOut | None = None
