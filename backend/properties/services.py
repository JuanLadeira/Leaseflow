"""Business rules for the portfolio: occupancy, pagination and unit creation.

Every public function takes the acting `user` first. It is checked twice:
its role must grant the Django permission, and only properties in its
portfolio are visible (accounts.permissions).
"""

from django.contrib.auth.models import AbstractBaseUser

from accounts.permissions import portfolio_of, require
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


async def list_properties(
    user: AbstractBaseUser, search: str | None, page: int, page_size: int
) -> dict:
    await require(user, "properties.view_property")
    params = PageParams.clamp(page, page_size)
    term = search.strip() if search else None
    items, count = await repositories.search_properties(
        portfolio_of(user), term, params.offset, params.page_size
    )
    return {
        "items": [to_summary(p) for p in items],
        "count": count,
        "page": params.page,
        "page_size": params.page_size,
    }


async def get_property(user: AbstractBaseUser, property_id: int) -> dict:
    await require(user, "properties.view_property", "properties.view_unit")
    prop = await repositories.get_property_with_stats(portfolio_of(user), property_id)
    if prop is None:
        raise NotFoundError("Property not found.")
    return {**to_summary(prop), "units": await repositories.list_units(property_id)}


async def create_property(user: AbstractBaseUser, data: dict) -> dict:
    """The creator becomes the property's first manager."""
    await require(user, "properties.add_property")
    return to_summary(await repositories.create_property(user.pk, **data))


async def create_unit(user: AbstractBaseUser, property_id: int, data: dict):
    await require(user, "properties.add_unit")
    if not await repositories.property_exists(portfolio_of(user), property_id):
        raise NotFoundError("Property not found.")
    return await repositories.create_unit(property_id, **data)


async def managed_property_ids(user: AbstractBaseUser) -> list[int] | None:
    """The user's portfolio as ids, or None when unrestricted (superuser)."""
    scope = portfolio_of(user)
    return None if scope is None else await repositories.managed_property_ids(scope)
