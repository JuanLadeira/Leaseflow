from django.contrib.auth import aauthenticate, get_user_model
from django.contrib.auth.models import AbstractBaseUser, Group, Permission
from django.db.models import Q

User = get_user_model()


async def get_active_user(user_id: int) -> AbstractBaseUser | None:
    return await User.objects.filter(pk=user_id, is_active=True).afirst()


async def active_user_exists(user_id: int) -> bool:
    return await User.objects.filter(pk=user_id, is_active=True).aexists()


async def authenticate(username: str, password: str) -> AbstractBaseUser | None:
    return await aauthenticate(username=username, password=password)


async def role_names(user_id: int) -> list[str]:
    qs = Group.objects.filter(user=user_id).order_by("name").values_list("name", flat=True)
    return [name async for name in qs]


def sync_group_permissions(name: str, perms: list[str]) -> None:
    """Sync (post_migrate runs outside the event loop): make `name` hold exactly `perms`."""
    group, _ = Group.objects.get_or_create(name=name)
    query = Q()
    for perm in perms:
        app_label, codename = perm.split(".")
        query |= Q(content_type__app_label=app_label, codename=codename)
    group.permissions.set(Permission.objects.filter(query))
