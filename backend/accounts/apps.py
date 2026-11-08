from django.apps import AppConfig
from django.db.models.signals import post_migrate


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self) -> None:
        from accounts.permissions import ensure_roles

        # post_migrate (not a data migration) so roles also survive test-DB flushes.
        post_migrate.connect(ensure_roles, dispatch_uid="accounts.ensure_roles")
