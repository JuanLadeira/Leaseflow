from django.contrib.auth import aauthenticate, get_user_model
from django.contrib.auth.models import AbstractBaseUser

User = get_user_model()


async def get_active_user(user_id: int) -> AbstractBaseUser | None:
    return await User.objects.filter(pk=user_id, is_active=True).afirst()


async def active_user_exists(user_id: int) -> bool:
    return await User.objects.filter(pk=user_id, is_active=True).aexists()


async def authenticate(username: str, password: str) -> AbstractBaseUser | None:
    return await aauthenticate(username=username, password=password)
