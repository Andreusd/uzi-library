from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from ..database import get_db, Database
from ..deps import get_request_user
from ..schemas import RecordActivityPayload, SetGoalPayload

router = APIRouter(prefix="/api/activity", tags=["activity"])

def get_database() -> Database:
    return get_db()

@router.post("/record")
def record_activity(
    payload: RecordActivityPayload,
    user: str = Depends(get_request_user),
    db: Database = Depends(get_database),
):
    """
    Records pages read on a given calendar date for a book.
    """
    date_str = payload.date
    if not date_str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if not payload.book_id:
        raise HTTPException(status_code=400, detail="book_id is required")

    result = db.record_reading_activity(
        user_slug=user,
        date_str=date_str,
        book_id=payload.book_id,
        pages=payload.pages,
        reading_time_seconds=payload.reading_time_seconds,
    )
    return {"status": "ok", "record": result}

@router.get("")
def get_activity_overview(
    days: int = Query(365, ge=7, le=730),
    today: Optional[str] = Query(None),
    user: str = Depends(get_request_user),
    db: Database = Depends(get_database),
):
    """
    Returns reading activity overview:
    - stats: streak, pages today, daily goal, total pages/days
    - history: daily summary for continuous activity heatmap
    - completed_books: list of completed books with dates
    """
    today_str = today or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    stats = db.get_reading_stats(user_slug=user, today_str=today_str)
    history = db.get_reading_activity_history(user_slug=user, days=days)
    return {
        "status": "ok",
        "stats": stats,
        "history": history,
    }

@router.get("/day")
def get_activity_for_date(
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: str = Depends(get_request_user),
    db: Database = Depends(get_database),
):
    """
    Returns book breakdown for a specific date.
    """
    details = db.get_activity_details_for_date(user_slug=user, date_str=date)
    return {
        "status": "ok",
        "date": date,
        "books": details,
    }

@router.get("/goal")
def get_user_goal(
    user: str = Depends(get_request_user),
    db: Database = Depends(get_database),
):
    """
    Returns user daily reading page goal.
    """
    goal = db.get_daily_goal(user)
    return {"status": "ok", "daily_pages_goal": goal}

@router.put("/goal")
def set_user_goal(
    payload: SetGoalPayload,
    user: str = Depends(get_request_user),
    db: Database = Depends(get_database),
):
    """
    Updates user daily reading page goal.
    """
    updated = db.set_daily_goal(user, payload.daily_pages_goal)
    return {"status": "ok", "daily_pages_goal": updated}
