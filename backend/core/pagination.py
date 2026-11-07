from dataclasses import dataclass


@dataclass(frozen=True)
class PageParams:
    page: int
    page_size: int

    @classmethod
    def clamp(cls, page: int, page_size: int, max_size: int = 100) -> "PageParams":
        return cls(page=max(1, page), page_size=max(1, min(page_size, max_size)))

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
