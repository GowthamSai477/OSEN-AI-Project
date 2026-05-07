from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import verify_clerk_token, ClerkUser
from ..models import Notification
import uuid

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def get_notifications(
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": str(n.id),
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "read": n.read,
            "link": n.link,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifications
    ]


@router.patch("/read-all")
def mark_all_read(
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"success": True}


@router.patch("/{notification_id}/read")
def mark_one_read(
    notification_id: str,
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    n = db.query(Notification).filter(
        Notification.id == nid,
        Notification.user_id == user.id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.read = True
    db.commit()
    return {"success": True}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    n = db.query(Notification).filter(
        Notification.id == nid,
        Notification.user_id == user.id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(n)
    db.commit()
    return {"success": True}


@router.delete("")
def delete_all_notifications(
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(Notification.user_id == user.id).delete()
    db.commit()
    return {"success": True}
