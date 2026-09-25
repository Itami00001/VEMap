from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import authenticate, create_access_token
from app.modules.auth.schema import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    admin = authenticate(db, body.email, body.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(admin.id))
    return TokenResponse(access_token=token)
