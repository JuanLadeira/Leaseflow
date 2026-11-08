"""Authorization rules shared by every entry point (REST and MCP).

Two independent checks, both enforced in the services layer:

* **Role (what you may do)**: Django model permissions granted through groups.
  `ROLES` is the single source of truth; `ensure_roles` syncs it after migrate.
* **Portfolio (which rows you may see)**: a user only sees the properties they
  manage, and everything hanging off them (units, leads, messages, metrics).
  Superusers are unrestricted.

Rows outside the portfolio raise `NotFoundError` rather than 403, so another
user's ids cannot be probed for existence.
"""

from django.contrib.auth.models import AbstractBaseUser

from accounts import repositories
from core.exceptions import PermissionDeniedError

LEASING_AGENT = "Leasing agent"
VIEWER = "Viewer"

_READ = [
    "properties.view_property",
    "properties.view_unit",
    "leads.view_lead",
    "leads.view_message",
    "visits.view_visit",
]

ROLES: dict[str, list[str]] = {
    LEASING_AGENT: [
        *_READ,
        "properties.add_property",
        "properties.add_unit",
        "leads.change_lead",
        "leads.add_message",
        "visits.add_visit",
        "visits.change_visit",
    ],
    VIEWER: _READ,
}


def ensure_roles(**kwargs) -> None:
    """post_migrate hook: create the groups and (re)assign their permissions."""
    for name, perms in ROLES.items():
        repositories.sync_group_permissions(name, perms)


async def require(user: AbstractBaseUser, *perms: str) -> None:
    for perm in perms:
        if not await user.ahas_perm(perm):
            raise PermissionDeniedError(f"Your role does not allow this action ({perm}).")


def portfolio_of(user: AbstractBaseUser) -> int | None:
    """The manager id that scopes queries, or None for an unrestricted superuser."""
    return None if user.is_superuser else user.pk
