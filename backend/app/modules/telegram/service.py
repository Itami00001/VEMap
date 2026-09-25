from sqlalchemy.orm import Session

from app.modules.regions.model import Region
from app.modules.responses.model import Response, ResponseSource
from app.modules.surveys.model import Question, Survey, SurveyStatus
from app.modules.telegram.model import TelegramUser


def upsert_user(db: Session, telegram_user_id: str, username: str | None) -> TelegramUser:
    user = db.get(TelegramUser, str(telegram_user_id))
    if not user:
        user = TelegramUser(telegram_user_id=str(telegram_user_id), username=username)
        db.add(user)
    else:
        user.username = username
    db.commit()
    db.refresh(user)
    return user


def set_region(db: Session, telegram_user_id: str, region_id: str) -> TelegramUser | None:
    user = db.get(TelegramUser, str(telegram_user_id))
    if not user:
        return None
    if not db.get(Region, region_id):
        return None
    user.region_id = region_id
    db.commit()
    db.refresh(user)
    return user


def get_active_survey(db: Session) -> Survey | None:
    return (
        db.query(Survey)
        .filter(Survey.status == SurveyStatus.active)
        .order_by(Survey.year.desc())
        .first()
    )


def save_survey_response(db: Session, user: TelegramUser, answers: dict) -> Response | None:
    survey = get_active_survey(db)
    if not survey or not user.region_id:
        return None
    db.add(
        Response(
            survey_id=survey.id,
            region_id=user.region_id,
            source=ResponseSource.telegram,
            user_id=user.telegram_user_id,
            answers=answers,
        )
    )
    db.commit()
    return True
