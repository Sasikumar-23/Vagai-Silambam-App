from fastapi import HTTPException, status


class ApiError(HTTPException):
    """Consistent error envelope: {"success": false, "message": ..., "code": ...}."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(status_code=status_code, detail={"success": False, "message": message, "code": code})


def unauthorized(message: str = "Authentication required") -> ApiError:
    return ApiError(status.HTTP_401_UNAUTHORIZED, "UNAUTHENTICATED", message)


def forbidden(code: str = "FORBIDDEN", message: str = "You do not have access to this resource") -> ApiError:
    return ApiError(status.HTTP_403_FORBIDDEN, code, message)


def not_found(message: str = "Resource not found") -> ApiError:
    return ApiError(status.HTTP_404_NOT_FOUND, "NOT_FOUND", message)


def bad_request(code: str, message: str) -> ApiError:
    return ApiError(status.HTTP_400_BAD_REQUEST, code, message)


def conflict(code: str, message: str) -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, code, message)


def plan_limit_reached(message: str) -> ApiError:
    return ApiError(status.HTTP_402_PAYMENT_REQUIRED, "PLAN_LIMIT_REACHED", message)


def subscription_inactive(code: str, message: str) -> ApiError:
    return ApiError(status.HTTP_402_PAYMENT_REQUIRED, code, message)
