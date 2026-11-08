from django.contrib.auth.models import AbstractBaseUser

from accounts.permissions import portfolio_of, require
from dashboard import repositories
from leads.models import Lead
from properties.services import occupancy_rate


async def get_metrics(user: AbstractBaseUser) -> dict:
    """Portfolio metrics, computed only over the properties the user manages."""
    await require(user, "properties.view_unit", "leads.view_lead")
    scope = portfolio_of(user)
    total, vacant = await repositories.unit_counts(scope)
    by_status = {s.value: 0 for s in Lead.Status} | await repositories.leads_by_status(scope)
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
