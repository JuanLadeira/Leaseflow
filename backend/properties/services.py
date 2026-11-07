"""Business rules for the portfolio: occupancy, pagination and unit creation."""

from core.exceptions import NotFoundError
from core.pagination import PageParams
from properties import repositories
from properties.models import Property


def occupancy_rate(unit_count: int, vacant_count: int) -> float:
    if unit_count == 0:
        return 0.0
    return round((unit_count - vacant_count) / unit_count, 4)


def to_summary(prop: Property) -> dict:
    return {
        "id": prop.pk,
        "name": prop.name,
        "address": prop.address,
        "city": prop.city,
        "state": prop.state,
        "image_url": prop.image_url,
        "unit_count": prop.unit_count,
        "vacant_count": prop.vacant_count,
        "occupancy_rate": occupancy_rate(prop.unit_count, prop.vacant_count),
    }


async def list_properties(search: str | None, page: int, page_size: int) -> dict:
    params = PageParams.clamp(page, page_size)
    term = search.strip() if search else None
    items, count = await repositories.search_properties(term, params.offset, params.page_size)
    return {
        "items": [to_summary(p) for p in items],
        "count": count,
        "page": params.page,
        "page_size": params.page_size,
    }


async def get_property(property_id: int) -> dict:
    prop = await repositories.get_property_with_stats(property_id)
    if prop is None:
        raise NotFoundError("Property not found.")
    return {**to_summary(prop), "units": await repositories.list_units(property_id)}


async def create_property(data: dict) -> dict:
    return to_summary(await repositories.create_property(**data))


async def create_unit(property_id: int, data: dict):
    if not await repositories.property_exists(property_id):
        raise NotFoundError("Property not found.")
    return await repositories.create_unit(property_id, **data)
