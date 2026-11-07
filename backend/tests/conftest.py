from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import AsyncClient

from accounts.services import create_token
from leads.models import Lead, Message
from properties.models import Property, Unit


@pytest.fixture
def user(transactional_db):
    return get_user_model().objects.create_user("agent", "agent@example.com", "s3cret-pass")


@pytest.fixture
def auth_client(user) -> AsyncClient:
    # AsyncClient takes raw ASGI header names (no HTTP_ prefix).
    token = create_token(user.pk, "access")
    return AsyncClient(AUTHORIZATION=f"Bearer {token}")


@pytest.fixture
def anon_client() -> AsyncClient:
    return AsyncClient()


@pytest.fixture
def property_with_units(transactional_db):
    prop = Property.objects.create(
        name="Maple Court", address="77 Maple", city="Chicago", state="IL"
    )
    Unit.objects.create(property=prop, label="1A", rent=Decimal("1800"), status="occupied")
    Unit.objects.create(property=prop, label="1B", rent=Decimal("1900"), status="vacant")
    Unit.objects.create(property=prop, label="2A", rent=Decimal("2100"), status="occupied")
    Unit.objects.create(property=prop, label="2B", rent=Decimal("2200"), status="occupied")
    return prop


@pytest.fixture
def lead(property_with_units):
    unit = property_with_units.units.get(label="1B")
    lead = Lead.objects.create(full_name="Ava Smith", email="ava@example.com", unit=unit)
    Message.objects.create(lead=lead, direction="inbound", body="Is 1B still available?")
    return lead


@pytest.fixture(autouse=True)
async def _close_async_db_connections():
    """Async ORM calls run in asgiref's worker thread, which keeps its own DB
    connection. Close it after each test so Postgres can drop the test DB."""
    yield
    from asgiref.sync import sync_to_async
    from django.db import connections

    await sync_to_async(connections.close_all)()
