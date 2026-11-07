import pytest

from accounts.tokens import create_token

pytestmark = pytest.mark.django_db(transaction=True)


async def test_login_returns_token_pair(user, anon_client):
    res = await anon_client.post(
        "/api/auth/login",
        {"username": "agent", "password": "s3cret-pass"},
        content_type="application/json",
    )
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"access", "refresh"}


async def test_login_rejects_bad_password(user, anon_client):
    res = await anon_client.post(
        "/api/auth/login",
        {"username": "agent", "password": "nope"},
        content_type="application/json",
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid username or password."


async def test_me_requires_bearer_token(anon_client):
    res = await anon_client.get("/api/auth/me")
    assert res.status_code == 401


async def test_me_returns_current_user(auth_client):
    res = await auth_client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json()["username"] == "agent"


async def test_refresh_token_cannot_be_used_as_access_token(user, anon_client):
    refresh = create_token(user.pk, "refresh")
    res = await anon_client.get("/api/auth/me", headers={"Authorization": f"Bearer {refresh}"})
    assert res.status_code == 401


async def test_refresh_issues_new_pair(user, anon_client):
    refresh = create_token(user.pk, "refresh")
    res = await anon_client.post(
        "/api/auth/refresh", {"refresh": refresh}, content_type="application/json"
    )
    assert res.status_code == 200
    assert "access" in res.json()
