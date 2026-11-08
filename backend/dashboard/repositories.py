"""Cross-app reads. Delegates to the owning apps' repositories instead of
querying their models directly, so each app stays the single owner of its data."""

from leads import repositories as leads_repo
from properties import repositories as properties_repo


async def unit_counts(manager_id: int | None) -> tuple[int, int]:
    return await properties_repo.unit_counts(manager_id)


async def leads_by_status(manager_id: int | None) -> dict[str, int]:
    return await leads_repo.count_by_status(manager_id)
