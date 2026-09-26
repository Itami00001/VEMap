from pydantic import BaseModel, EmailStr

from app.modules.auth.model import AdminRole


class LoginRequest(BaseModel):
    # str вместо EmailStr: системные домены (.local) валидны для логина.
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminOut(BaseModel):
    id: int
    email: EmailStr
    role: AdminRole
    is_active: bool
