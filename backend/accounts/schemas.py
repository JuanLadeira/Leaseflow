from ninja import Schema


class LoginIn(Schema):
    username: str
    password: str


class RefreshIn(Schema):
    refresh: str


class TokenPairOut(Schema):
    access: str
    refresh: str


class UserOut(Schema):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str


class ErrorOut(Schema):
    detail: str
