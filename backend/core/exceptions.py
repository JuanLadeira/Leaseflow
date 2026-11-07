"""Domain exceptions raised by services and translated to HTTP by the API layer.

Services never import Ninja/HTTP types: they raise these, and `config/api.py`
registers one handler per exception. That keeps business rules testable
without a request object.
"""


class DomainError(Exception):
    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class NotFoundError(DomainError):
    status_code = 404


class AuthenticationError(DomainError):
    status_code = 401
