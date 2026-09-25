from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, get_db, require_superadmin
from app.modules.admin.export_service import export_json
from app.modules.admin.import_service import confirm_import, preview_import
from app.modules.admin.logs import AuditLog, write_log
from app.modules.auth.model import Admin, AdminRole
from app.modules.moods.model import MoodRecord
from app.modules.moods.service import recalculate_for
from app.modules.surveys.model import Survey
from app.modules.surveys.schema import SurveyCreate, SurveyOut, SurveyUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


class ImportBody(BaseModel):
    survey_id: int
    data: dict
    confirm: bool = False


class PublishBody(BaseModel):
    record_ids: list[int]


@router.get("/surveys", response_model=list[SurveyOut])
def admin_list_surveys(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(Survey).order_by(Survey.year.desc()).all()


@router.post("/surveys", response_model=SurveyOut)
def admin_create_survey(
    body: SurveyCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    survey = Survey(**body.model_dump())
    db.add(survey)
    db.commit()
    db.refresh(survey)
    write_log(db, admin.id, "create", f"survey #{survey.id}")
    return survey


@router.put("/surveys/{survey_id}", response_model=SurveyOut)
def admin_update_survey(
    survey_id: int,
    body: SurveyUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(survey, k, v)
    db.commit()
    db.refresh(survey)
    write_log(db, admin.id, "update", f"survey #{survey.id}")
    return survey


@router.delete("/surveys/{survey_id}")
def admin_delete_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_superadmin),
):
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    db.delete(survey)
    db.commit()
    write_log(db, admin.id, "delete", f"survey #{survey_id}")
    return {"ok": True}


@router.get("/data")
def admin_data(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = db.query(MoodRecord).order_by(MoodRecord.year.desc()).all()
    return [
        {
            "id": r.id,
            "region_id": r.region_id,
            "year": r.year,
            "mood_index": r.mood_index,
            "responses_count": r.responses_count,
            "is_public": r.is_public,
        }
        for r in rows
    ]


@router.put("/data/{record_id}")
def admin_update_data(
    record_id: int,
    body: dict,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    rec = db.get(MoodRecord, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    if "mood_index" in body:
        rec.mood_index = float(body["mood_index"])
    if "is_public" in body:
        rec.is_public = bool(body["is_public"])
    db.commit()
    write_log(db, admin.id, "update", f"mood_record #{record_id}")
    return {"ok": True}


@router.delete("/data/{record_id}")
def admin_delete_data(
    record_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_superadmin),
):
    rec = db.get(MoodRecord, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(rec)
    db.commit()
    write_log(db, admin.id, "delete", f"mood_record #{record_id}")
    return {"ok": True}


@router.post("/import")
def admin_import(
    body: ImportBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not body.confirm:
        preview = preview_import(db, body.data)
        if not preview["valid"]:
            return {"stage": "validation", "ok": False, **preview}
        return {"stage": "preview", "ok": True, **preview}
    result = confirm_import(db, body.data, body.survey_id)
    if result["ok"]:
        recalculate_for(db, body.survey_id)
        write_log(db, admin.id, "import", f"survey #{body.survey_id}", str(result["imported"]))
    return {"stage": "import", **result}


@router.post("/publish")
def admin_publish(
    body: PublishBody,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    for rid in body.record_ids:
        rec = db.get(MoodRecord, rid)
        if rec:
            rec.is_public = True
    db.commit()
    write_log(db, admin.id, "publish", "mood_records", str(body.record_ids))
    return {"ok": True}


@router.get("/export")
def admin_export(db: Session = Depends(get_db), admin: Admin = Depends(require_superadmin)):
    return {"dataset": export_json(db)}


@router.get("/logs")
def admin_logs(db: Session = Depends(get_db), admin: Admin = Depends(require_superadmin)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(200).all()
    return [
        {
            "id": l.id,
            "admin_id": l.admin_id,
            "action": l.action,
            "entity": l.entity,
            "details": l.details,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]
