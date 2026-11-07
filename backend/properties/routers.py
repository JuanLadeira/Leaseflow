from ninja import Query, Router, Status

from core.schemas import ErrorOut, Page
from properties import services
from properties.schemas import (
    PropertyDetailOut,
    PropertyFilters,
    PropertyIn,
    PropertyOut,
    UnitIn,
    UnitOut,
)

router = Router(tags=["properties"])


@router.get("/properties", response=Page[PropertyOut])
async def list_properties(request, filters: Query[PropertyFilters]):
    return await services.list_properties(filters.search, filters.page, filters.page_size)


@router.post("/properties", response={201: PropertyOut})
async def create_property(request, payload: PropertyIn):
    return Status(201, await services.create_property(payload.dict()))


@router.get("/properties/{property_id}", response={200: PropertyDetailOut, 404: ErrorOut})
async def get_property(request, property_id: int):
    return await services.get_property(property_id)


@router.post("/properties/{property_id}/units", response={201: UnitOut, 404: ErrorOut})
async def create_unit(request, property_id: int, payload: UnitIn):
    return Status(201, await services.create_unit(property_id, payload.dict()))
