import pytest

from properties.models import Property

pytestmark = pytest.mark.django_db(transaction=True)


async def test_leasing_endpoints_require_auth(anon_client):
    res = await anon_client.get("/api/properties")
    assert res.status_code == 401


async def test_list_properties_includes_occupancy(auth_client, property_with_units):
    res = await auth_client.get("/api/properties")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 1
    item = body["items"][0]
    assert item["unit_count"] == 4
    assert item["vacant_count"] == 1
    assert item["occupancy_rate"] == 0.75


async def test_list_properties_search_and_pagination(auth_client, user):
    for i in range(15):
        prop = await Property.objects.acreate(
            name=f"Tower {i}", address="1 Main", city="Austin" if i % 2 else "Denver", state="TX"
        )
        await prop.managers.aadd(user)
    res = await auth_client.get("/api/properties", {"search": "austin", "page_size": 5, "page": 2})
    body = res.json()
    assert body["count"] == 7
    assert body["page"] == 2
    assert len(body["items"]) == 2


async def test_create_property_validates_payload(auth_client):
    res = await auth_client.post(
        "/api/properties",
        {"name": "X", "address": "a", "city": "", "state": "TEX"},
        content_type="application/json",
    )
    assert res.status_code == 422


async def test_property_detail_lists_units(auth_client, property_with_units):
    res = await auth_client.get(f"/api/properties/{property_with_units.pk}")
    assert res.status_code == 200
    assert [u["label"] for u in res.json()["units"]] == ["1A", "1B", "2A", "2B"]


async def test_create_unit(auth_client, property_with_units):
    res = await auth_client.post(
        f"/api/properties/{property_with_units.pk}/units",
        {"label": "3A", "bedrooms": 2, "bathrooms": "2.0", "square_feet": 980, "rent": "2500"},
        content_type="application/json",
    )
    assert res.status_code == 201
    assert res.json()["status"] == "vacant"


async def test_property_not_found(auth_client):
    res = await auth_client.get("/api/properties/9999")
    assert res.status_code == 404
