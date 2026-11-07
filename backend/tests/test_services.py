"""Service-layer tests: business rules exercised without HTTP."""

import pytest

from accounts import services as auth_services
from core.exceptions import AuthenticationError, NotFoundError
from core.pagination import PageParams
from leads import services as lead_services
from properties.services import occupancy_rate

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.mark.parametrize(
    ("units", "vacant", "expected"), [(0, 0, 0.0), (4, 1, 0.75), (3, 3, 0.0), (3, 0, 1.0)]
)
def test_occupancy_rate(units, vacant, expected):
    assert occupancy_rate(units, vacant) == expected


def test_page_params_are_clamped():
    params = PageParams.clamp(page=-3, page_size=500)
    assert (params.page, params.page_size, params.offset) == (1, 100, 0)


async def test_first_reply_moves_new_lead_to_contacted(lead):
    await lead_services.send_message(lead.pk, "Hi!", ai_generated=False)
    detail = await lead_services.get_lead_detail(lead.pk)
    assert detail["status"] == "contacted"


async def test_reply_does_not_regress_advanced_status(lead):
    await lead_services.change_status(lead.pk, "applied")
    await lead_services.send_message(lead.pk, "Got your application", ai_generated=False)
    assert (await lead_services.get_lead_detail(lead.pk))["status"] == "applied"


async def test_missing_lead_raises_not_found(transactional_db):
    with pytest.raises(NotFoundError):
        await lead_services.get_lead_detail(12345)


async def test_login_with_wrong_password_raises(user):
    with pytest.raises(AuthenticationError):
        await auth_services.login("agent", "wrong-password")
