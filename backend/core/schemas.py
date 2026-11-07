from ninja import Schema


class Page[T](Schema):
    items: list[T]
    count: int
    page: int
    page_size: int


class ErrorOut(Schema):
    detail: str
