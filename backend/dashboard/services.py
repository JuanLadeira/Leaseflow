from dashboard import repositories
from leads.models import Lead
from properties.services import occupancy_rate


async def get_metrics() -> dict:
    total, vacant = await repositories.unit_counts()
    by_status = {s.value: 0 for s in Lead.Status} | await repositories.leads_by_status()
    total_leads = sum(by_status.values())
    return {
        "total_units": total,
        "vacant_units": vacant,
        "occupancy_rate": occupancy_rate(total, vacant),
        "leads_by_status": by_status,
        "conversion_rate": round(by_status[Lead.Status.WON] / total_leads, 4)
        if total_leads
        else 0.0,
    }
