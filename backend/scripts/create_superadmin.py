import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.core.security import hash_password
from app.db.database import Base, SessionLocal, engine
from app.modules.auth.model import Admin, AdminRole


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Admin).filter(Admin.email == settings.ADMIN_EMAIL).first()
        if existing:
            print("Super admin already exists")
            return
        admin = Admin(
            email=settings.ADMIN_EMAIL,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            role=AdminRole.SUPER_ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Created super admin {settings.ADMIN_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
