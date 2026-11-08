"""Role and portfolio rules, exercised through the REST API.

The MCP tests (test_mcp.py) repeat the same scenarios through the MCP
transport: both entry points share these services, so both must agree.
"""

import pytest

from leads.models import Lead, Message
from properties.models import Property, Unit
from tests.conftest import client_for

pytestmark = pytest.mark.django_db(transaction=True)


async def test_lists_only_show_the_users_portfolio(auth_client, lead, other_lead):
    leads = (await auth_client.get("/api/leads")).json()
    assert [row["full_name"] for row in leads] == ["Ava Smith"]

    props = (await auth_client.get("/api/properties")).json()
    assert [p["name"] for p in props["items"]] == ["Maple Court"]


async def test_dashboard_counts_only_the_users_portfolio(auth_client, lead, other_lead):
    body = (await auth_client.get("/api/dashboard")).json()
    assert body["total_units"] == 4
    assert body["leads_by_status"]["new"] == 1


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("get", "/api/leads/{id}", None),
        ("patch", "/api/leads/{id}", {"status": "won"}),
        ("post", "/api/leads/{id}/messages", {"body": "hi"}),
        ("post", "/api/leads/{id}/reply-suggestion", None),
    ],
)
async def test_another_agents_lead_is_reported_as_missing(
    auth_client, other_lead, method, path, payload
):
    kwargs = {"content_type": "application/json", "data": payload} if payload else {}
    res = await getattr(auth_client, method)(path.format(id=other_lead.pk), **kwargs)
    assert res.status_code == 404
    await other_lead.arefresh_from_db()
    assert other_lead.status == "new"
    assert await Message.objects.filter(lead=other_lead).acount() == 1


async def test_another_agents_property_is_reported_as_missing(auth_client, other_lead):
    prop_id = (await Unit.objects.aget(pk=other_lead.unit_id)).property_id
    assert (await auth_client.get(f"/api/properties/{prop_id}")).status_code == 404
    res = await auth_client.post(
        f"/api/properties/{prop_id}/units",
        {"label": "9Z", "bedrooms": 1, "bathrooms": 1, "square_feet": 500, "rent": 1000},
        content_type="application/json",
    )
    assert res.status_code == 404


async def test_viewer_can_read_but_not_write(viewer, lead):
    await (await Property.objects.aget(name="Maple Court")).managers.aadd(viewer)
    client = client_for(viewer)
    assert (await client.get(f"/api/leads/{lead.pk}")).status_code == 200

    res = await client.patch(
        f"/api/leads/{lead.pk}", {"status": "won"}, content_type="application/json"
    )
    assert res.status_code == 403
    assert "leads.change_lead" in res.json()["detail"]
    res = await client.post(
        f"/api/leads/{lead.pk}/messages", {"body": "hi"}, content_type="application/json"
    )
    assert res.status_code == 403
    await lead.arefresh_from_db()
    assert lead.status == Lead.Status.NEW


async def test_creator_manages_the_new_property(auth_client, user):
    res = await auth_client.post(
        "/api/properties",
        {"name": "Oak Row", "address": "1 Oak St", "city": "Denver", "state": "CO"},
        content_type="application/json",
    )
    assert res.status_code == 201
    prop = await Property.objects.aget(pk=res.json()["id"])
    assert await prop.managers.filter(pk=user.pk).aexists()


async def test_user_without_a_role_is_forbidden(transactional_db):
    from django.contrib.auth import get_user_model

    nobody = await get_user_model().objects.acreate_user("nobody", password="x-pass-123")
    assert (await client_for(nobody).get("/api/leads")).status_code == 403
