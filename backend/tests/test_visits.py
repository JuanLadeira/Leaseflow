from datetime import timedelta

import pytest
from django.utils import timezone

from leads.models import Lead
from visits.models import Visit

pytestmark = pytest.mark.django_db(transaction=True)


def _slot(days: int = 1, hour: int = 10, minutes: int = 30):
    start = (timezone.now() + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    return start, start + timedelta(minutes=minutes)


async def _book(client, lead, start, end, **extra):
    return await client.post(
        "/api/visits",
        {"lead_id": lead.pk, "starts_at": start.isoformat(), "ends_at": end.isoformat(), **extra},
        content_type="application/json",
    )


async def test_schedule_visit_defaults_to_lead_unit_and_advances_pipeline(auth_client, lead, user):
    start, end = _slot()
    res = await _book(auth_client, lead, start, end, notes="  Has a dog  ")
    assert res.status_code == 201
    body = res.json()
    assert body["unit_label"] == "1B"
    assert body["property_name"] == "Maple Court"
    assert body["agent_id"] == user.pk
    assert body["notes"] == "Has a dog"
    await lead.arefresh_from_db()
    assert lead.status == Lead.Status.TOUR_SCHEDULED


async def test_overlapping_visit_on_same_unit_is_a_409(auth_client, lead):
    start, end = _slot()
    assert (await _book(auth_client, lead, start, end)).status_code == 201
    res = await _book(auth_client, lead, start + timedelta(minutes=15), end + timedelta(minutes=15))
    assert res.status_code == 409
    assert "already has a visit" in res.json()["detail"]
    assert res.json()["conflict"]["lead_name"] == "Ava Smith"


async def test_back_to_back_visits_are_allowed(auth_client, lead):
    start, end = _slot()
    assert (await _book(auth_client, lead, start, end)).status_code == 201
    assert (await _book(auth_client, lead, end, end + timedelta(minutes=30))).status_code == 201


async def test_same_agent_cannot_be_in_two_places(auth_client, lead, property_with_units):
    other_unit = await property_with_units.units.aget(label="2A")
    start, end = _slot()
    assert (await _book(auth_client, lead, start, end)).status_code == 201
    res = await _book(auth_client, lead, start, end, unit_id=other_unit.pk)
    assert res.status_code == 409


async def test_canceled_visit_frees_the_slot_and_is_hidden(auth_client, lead):
    start, end = _slot()
    visit_id = (await _book(auth_client, lead, start, end)).json()["id"]
    res = await auth_client.patch(
        f"/api/visits/{visit_id}", {"status": "canceled"}, content_type="application/json"
    )
    assert res.json()["status"] == "canceled"
    assert (await _book(auth_client, lead, start, end)).status_code == 201
    listed = (await auth_client.get("/api/visits")).json()
    assert [v["status"] for v in listed] == ["scheduled"]
    listed = (await auth_client.get("/api/visits", {"include_canceled": True})).json()
    assert len(listed) == 2


async def test_canceled_visit_cannot_be_reopened(auth_client, lead):
    start, end = _slot()
    visit_id = (await _book(auth_client, lead, start, end)).json()["id"]
    await auth_client.patch(
        f"/api/visits/{visit_id}", {"status": "canceled"}, content_type="application/json"
    )
    res = await auth_client.patch(
        f"/api/visits/{visit_id}", {"status": "scheduled"}, content_type="application/json"
    )
    assert res.status_code == 400


async def test_rejects_past_visits_and_bad_ranges(auth_client, lead):
    start, end = _slot(days=-1)
    assert (await _book(auth_client, lead, start, end)).status_code == 400
    start, end = _slot()
    assert (await _book(auth_client, lead, end, start)).status_code == 422
    assert (await _book(auth_client, lead, start, start + timedelta(hours=3))).status_code == 422


async def test_lead_without_unit_needs_an_explicit_unit(auth_client, user):
    """Leads with no unit of interest belong to no portfolio: only superusers see them."""
    lead = await Lead.objects.acreate(full_name="No Unit", email="nu@example.com")
    start, end = _slot()
    assert (await _book(auth_client, lead, start, end)).status_code == 404

    user.is_superuser = True
    await user.asave()
    res = await _book(auth_client, lead, start, end)
    assert res.status_code == 400
    assert "unit" in res.json()["detail"]


async def test_list_visits_filters_by_range(auth_client, lead):
    start, end = _slot(days=1)
    await _book(auth_client, lead, start, end)
    later_start, later_end = _slot(days=8)
    await _book(auth_client, lead, later_start, later_end)
    res = await auth_client.get(
        "/api/visits",
        {"start": start.isoformat(), "end": (start + timedelta(days=7)).isoformat()},
    )
    assert [v["starts_at"][:10] for v in res.json()] == [start.date().isoformat()]
    assert await Visit.objects.acount() == 2


async def test_visits_require_auth(anon_client):
    assert (await anon_client.get("/api/visits")).status_code == 401


async def test_cannot_book_or_see_visits_outside_the_portfolio(auth_client, other_lead):
    start, end = _slot()
    assert (await _book(auth_client, other_lead, start, end)).status_code == 404
    await Visit.objects.acreate(
        lead=other_lead, unit_id=other_lead.unit_id, starts_at=start, ends_at=end
    )
    assert (await auth_client.get("/api/visits")).json() == []
    visit = await Visit.objects.aget(lead=other_lead)
    res = await auth_client.patch(
        f"/api/visits/{visit.pk}", {"status": "canceled"}, content_type="application/json"
    )
    assert res.status_code == 404


async def test_viewer_sees_the_agenda_but_cannot_book(viewer, lead, property_with_units):
    from tests.conftest import client_for

    await property_with_units.managers.aadd(viewer)
    client = client_for(viewer)
    assert (await client.get("/api/visits")).status_code == 200
    start, end = _slot()
    res = await _book(client, lead, start, end)
    assert res.status_code == 403
    assert "visits.add_visit" in res.json()["detail"]
