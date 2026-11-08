"""Data access for properties and units. Only ORM code lives here.

Every read takes `manager_id`: the id of the user whose portfolio scopes the
query, or None for unrestricted access (superusers). Services decide which.
"""

from django.db.models import Count, Q, QuerySet

from properties.models import Property, Unit


def _in_portfolio(qs: QuerySet, manager_id: int | None, path: str = "managers") -> QuerySet:
    return qs if manager_id is None else qs.filter(**{path: manager_id})


def _with_stats(manager_id: int | None) -> QuerySet[Property]:
    return _in_portfolio(Property.objects.all(), manager_id).annotate(
        unit_count=Count("units", distinct=True),
        vacant_count=Count("units", filter=Q(units__status=Unit.Status.VACANT), distinct=True),
    )


async def search_properties(
    manager_id: int | None, term: str | None, offset: int, limit: int
) -> tuple[list[Property], int]:
    qs = _with_stats(manager_id)
    if term:
        qs = qs.filter(
            Q(name__icontains=term) | Q(city__icontains=term) | Q(address__icontains=term)
        )
    count = await qs.acount()
    items = [p async for p in qs[offset : offset + limit]]
    return items, count


async def get_property_with_stats(manager_id: int | None, property_id: int) -> Property | None:
    return await _with_stats(manager_id).filter(pk=property_id).afirst()


async def property_exists(manager_id: int | None, property_id: int) -> bool:
    qs = _in_portfolio(Property.objects.filter(pk=property_id), manager_id)
    return await qs.aexists()


async def create_property(manager_id: int, **fields) -> Property:
    prop = await Property.objects.acreate(**fields)
    await prop.managers.aadd(manager_id)
    return await _with_stats(None).aget(pk=prop.pk)


async def list_units(property_id: int) -> list[Unit]:
    return [u async for u in Unit.objects.filter(property_id=property_id)]


async def create_unit(property_id: int, **fields) -> Unit:
    return await Unit.objects.acreate(property_id=property_id, **fields)


async def unit_counts(manager_id: int | None) -> tuple[int, int]:
    qs = _in_portfolio(Unit.objects.all(), manager_id, "property__managers")
    agg = await qs.aaggregate(
        total=Count("id", distinct=True),
        vacant=Count("id", filter=Q(status=Unit.Status.VACANT), distinct=True),
    )
    return agg["total"], agg["vacant"]


async def managed_property_ids(manager_id: int) -> list[int]:
    qs = Property.objects.filter(managers=manager_id).order_by("pk").values_list("pk", flat=True)
    return [pk async for pk in qs]
