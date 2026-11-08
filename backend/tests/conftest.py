from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import AsyncClient

from accounts.permissions import LEASING_AGENT, VIEWER
from accounts.services import create_token
from leads.models import Lead, Message
from properties.models import Property, Unit


def make_user(username: str, role: str):
    user = get_user_model().objects.create_user(username, f"{username}@example.com", "s3cret-pass")
    user.groups.add(Group.objects.get(name=role))
    return user


def client_for(user) -> AsyncClient:
    # AsyncClient takes raw ASGI header names (no HTTP_ prefix).
    return AsyncClient(AUTHORIZATION=f"Bearer {create_token(user.pk, 'access')}")


@pytest.fixture
def user(transactional_db):
    """A leasing agent who manages `property_with_units`."""
    return make_user("agent", LEASING_AGENT)


@pytest.fixture
def other_agent(transactional_db):
    """A second leasing agent with a portfolio of their own (`other_lead`)."""
    return make_user("other-agent", LEASING_AGENT)


@pytest.fixture
def viewer(transactional_db):
    """A read-only user who also manages `property_with_units`."""
    return make_user("viewer", VIEWER)


@pytest.fixture
def auth_client(user) -> AsyncClient:
    return client_for(user)


@pytest.fixture
def anon_client() -> AsyncClient:
    return AsyncClient()


@pytest.fixture
def property_with_units(user):
    prop = Property.objects.create(
        name="Maple Court", address="77 Maple", city="Chicago", state="IL"
    )
    prop.managers.add(user)
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


@pytest.fixture
def other_lead(other_agent):
    """A lead in another agent's portfolio: `user` must never reach it."""
    prop = Property.objects.create(name="Birch Lofts", address="9 Birch", city="Austin", state="TX")
    prop.managers.add(other_agent)
    unit = Unit.objects.create(property=prop, label="7C", rent=Decimal("2500"), status="vacant")
    lead = Lead.objects.create(full_name="Noah Park", email="noah@example.com", unit=unit)
    Message.objects.create(lead=lead, direction="inbound", body="Private question about 7C")
    return lead


@pytest.fixture(autouse=True)
async def _close_async_db_connections():
    """Async ORM calls run in asgiref's worker thread, which keeps its own DB
    connection. Close it after each test so Postgres can drop the test DB."""
    yield
    from asgiref.sync import sync_to_async
    from django.db import connections

    await sync_to_async(connections.close_all)()
