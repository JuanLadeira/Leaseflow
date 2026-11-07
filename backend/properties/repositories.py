"""Data access for properties and units. Only ORM code lives here."""

from django.db.models import Count, Q, QuerySet

from properties.models import Property, Unit


def _with_stats() -> QuerySet[Property]:
    return Property.objects.annotate(
        unit_count=Count("units", distinct=True),
        vacant_count=Count("units", filter=Q(units__status=Unit.Status.VACANT), distinct=True),
    )


async def search_properties(
    term: str | None, offset: int, limit: int
) -> tuple[list[Property], int]:
    qs = _with_stats()
    if term:
        qs = qs.filter(
            Q(name__icontains=term) | Q(city__icontains=term) | Q(address__icontains=term)
        )
    count = await qs.acount()
    items = [p async for p in qs[offset : offset + limit]]
    return items, count


async def get_property_with_stats(property_id: int) -> Property | None:
    return await _with_stats().filter(pk=property_id).afirst()


async def property_exists(property_id: int) -> bool:
    return await Property.objects.filter(pk=property_id).aexists()


async def create_property(**fields) -> Property:
    prop = await Property.objects.acreate(**fields)
    return await _with_stats().aget(pk=prop.pk)


async def list_units(property_id: int) -> list[Unit]:
    return [u async for u in Unit.objects.filter(property_id=property_id)]


async def create_unit(property_id: int, **fields) -> Unit:
    return await Unit.objects.acreate(property_id=property_id, **fields)


async def unit_counts() -> tuple[int, int]:
    agg = await Unit.objects.aaggregate(
        total=Count("id"), vacant=Count("id", filter=Q(status=Unit.Status.VACANT))
    )
    return agg["total"], agg["vacant"]
