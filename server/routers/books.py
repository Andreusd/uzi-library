import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import FileResponse
import pypdfium2 as pdfium

from ..scanner import LibraryScanner
from ..covers import CoverManager
from ..users import UserManager
from ..deps import (
    get_scanner,
    get_cover_mgr,
    get_user_mgr,
    get_request_user,
)
from ..schemas import (
    ProgressPayload,
    ZoomPayload,
    NightModePayload,
    StatusPayload,
    RenameShelfPayload,
    SetShelfIconPayload,
    ToggleFavoritePayload,
)

router = APIRouter(tags=["books"])

@router.get("/api/folders")
@router.get("/api/shelves")
def list_folders(library_id: Optional[str] = Query(None), scanner: LibraryScanner = Depends(get_scanner)):
    """Returns list of all folders with book counts for a specific or active library."""
    lib_val = library_id if isinstance(library_id, str) else None
    folders = scanner.get_folders(library_id=lib_val)
    total_books = sum(s["book_count"] for s in folders)
    return {
        "folders": folders,
        "shelves": folders,
        "total_folders": len(folders),
        "total_shelves": len(folders),
        "total_books": total_books,
        "library_id": lib_val or scanner.config_mgr.get_active_library_id()
    }

@router.post("/api/folders/rename")
@router.post("/api/shelves/rename")
def rename_folder(payload: RenameShelfPayload, scanner: LibraryScanner = Depends(get_scanner)):
    """Virtually renames a folder inside the app without changing the physical folder."""
    target_id = payload.folder_id or payload.shelf_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing folder_id or shelf_id")
    scanner.set_shelf_alias(target_id, payload.custom_name, library_id=payload.library_id)
    folders = scanner.get_folders(library_id=payload.library_id)
    return {
        "status": "ok",
        "folders": folders,
        "shelves": folders,
        "folder_id": target_id,
        "shelf_id": target_id,
        "name": scanner.get_shelf_display_name(target_id, library_id=payload.library_id)
    }

@router.post("/api/folders/icon")
@router.post("/api/shelves/icon")
def set_folder_icon(payload: SetShelfIconPayload, scanner: LibraryScanner = Depends(get_scanner)):
    """Sets or resets the icon for a folder without changing the physical folder."""
    target_id = payload.folder_id or payload.shelf_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing folder_id or shelf_id")
    icon = scanner.set_shelf_icon(target_id, payload.icon, library_id=payload.library_id)
    folders = scanner.get_folders(library_id=payload.library_id)
    return {
        "status": "ok",
        "folders": folders,
        "shelves": folders,
        "folder_id": target_id,
        "shelf_id": target_id,
        "icon": icon
    }

@router.get("/api/books")
def list_books(
    shelf: Optional[str] = Query(None, description="Filter by folder or shelf name"),
    folder: Optional[str] = Query(None, description="Filter by folder name"),
    tag: Optional[str] = Query(None, description="Filter by tag ID"),
    library_id: Optional[str] = Query(None, description="Filter by library ID"),
    query: Optional[str] = Query(None, description="Search query across titles"),
    sort: Optional[str] = Query("title_asc", description="Sort order: title_asc, title_desc, size_desc, recent"),
    format: Optional[str] = Query(None, description="Filter by book format: pdf, epub"),
    user: str = Depends(get_request_user),
    scanner: LibraryScanner = Depends(get_scanner),
    user_mgr: UserManager = Depends(get_user_mgr),
):
    """Returns books enriched with reading progress, favorite status, tags, and cover URLs, strictly isolated by library and user."""
    tracker = user_mgr.get_tracker(user)
    favorites_mgr = user_mgr.get_favorites_mgr(user)
    tags_mgr = user_mgr.get_tags_mgr(user)

    shelf_val = shelf if isinstance(shelf, str) else None
    folder_val = folder if isinstance(folder, str) else None
    tag_val = tag if isinstance(tag, str) else None
    query_val = query if isinstance(query, str) else None
    sort_val = sort if isinstance(sort, str) else "title_asc"
    lib_val = library_id if isinstance(library_id, str) else None
    format_val = format.lower().strip() if isinstance(format, str) and format.strip() else None

    active_filter = folder_val or shelf_val
    if active_filter and active_filter.startswith("tag:"):
        tag_val = active_filter[4:]
        active_filter = None

    if tag_val:
        tagged_ids = set(tags_mgr.get_book_ids_for_tag(tag_val))
        books = [b for b in scanner.get_books(library_id=lib_val) if b["id"] in tagged_ids]
    elif active_filter == "favorites":
        books = [b for b in scanner.get_books(library_id=lib_val) if favorites_mgr.is_favorite(b["id"])]
    elif active_filter == "continue-reading":
        all_prog = tracker.get_all()
        in_prog_ids = {
            b_id for b_id, p in all_prog.items()
            if p.get("status") not in ("not_started", "completed")
            and (p.get("page", 1) > 1 or p.get("cfi") or p.get("percent", 0) > 0)
            and p.get("percent", 0) < 100
        }
        books = [b for b in scanner.get_books(library_id=lib_val) if b["id"] in in_prog_ids]
    else:
        books = scanner.get_books(folder_filter=active_filter, library_id=lib_val)
    all_progress = tracker.get_all()

    # Enrich each book with reading progress, favorite status, tags, and cover URL
    for b in books:
        prog = all_progress.get(b["id"])
        if prog:
            p_pct = prog.get("percent", 0)
            p_cfi = prog.get("cfi")
            if (p_pct is None or p_pct <= 0) and p_cfi and b.get("path") and b["path"].lower().endswith(".epub"):
                est = scanner.estimate_epub_percent(b["path"], p_cfi)
                if est is not None and est > 0:
                    prog["percent"] = est
                    tracker._data[b["id"]]["percent"] = est
                    tracker._save()
            elif not p_cfi and prog.get("total_pages", 0) > 1 and prog.get("page", 0) > 0:
                calc_pct = round((prog["page"] / prog["total_pages"]) * 100, 1)
                if abs((p_pct or 0) - calc_pct) > 0.5:
                    prog["percent"] = calc_pct
                    tracker._data[b["id"]]["percent"] = calc_pct
                    tracker._save()
        b["progress"] = prog if prog else {"page": 1, "total_pages": 0, "percent": 0}
        b["cover_url"] = f"/api/cover/{b['id']}"
        b["is_favorite"] = favorites_mgr.is_favorite(b["id"])
        b["tags"] = tags_mgr.get_book_tags(b["id"])

    # Filter by search query if provided
    if query_val:
        q = query_val.lower().strip()
        books = [
            b for b in books 
            if q in b["title"].lower() 
            or q in b.get("folder_display", "").lower() 
            or q in b.get("shelf_display", "").lower()
            or any(q in t.get("name", "").lower() for t in b.get("tags", []))
        ]

    # Filter by format if provided
    if format_val and format_val in ("pdf", "epub"):
        books = [
            b for b in books
            if b.get("format") == format_val or b.get("path", "").lower().endswith(f".{format_val}")
        ]

    # Sort
    if sort_val == "title_asc":
        if active_filter == "continue-reading":
            books.sort(key=lambda x: x["progress"].get("updated_at", ""), reverse=True)
        else:
            books.sort(key=lambda x: x["title"].lower())
    elif sort_val == "title_desc":
        books.sort(key=lambda x: x["title"].lower(), reverse=True)
    elif sort_val == "size_desc":
        books.sort(key=lambda x: x["size_bytes"], reverse=True)
    elif sort_val == "recent":
        books.sort(key=lambda x: x["progress"].get("updated_at", ""), reverse=True)

    # Show favorites first inside each folder (stable sort preserves primary ordering)
    if active_filter and active_filter not in ("continue-reading", "favorites"):
        books.sort(key=lambda x: 0 if x.get("is_favorite") else 1)

    return {
        "books": books,
        "count": len(books),
    }

@router.get("/api/continue-reading")
def continue_reading(
    library_id: Optional[str] = Query(None),
    format: Optional[str] = Query(None, description="Filter by book format: pdf, epub"),
    user: str = Depends(get_request_user),
    scanner: LibraryScanner = Depends(get_scanner),
    user_mgr: UserManager = Depends(get_user_mgr)
):
    """Returns recently opened books that have reading progress, strictly scoped to library and user."""
    tracker = user_mgr.get_tracker(user)
    favorites_mgr = user_mgr.get_favorites_mgr(user)
    tags_mgr = user_mgr.get_tags_mgr(user)

    lib_val = library_id if isinstance(library_id, str) else None
    format_val = format.lower().strip() if isinstance(format, str) and format.strip() else None
    recents = tracker.get_recent(limit=25)
    # Strictly isolate: only books physically belonging to this library
    lib_books = {b["id"]: b for b in scanner.get_books(library_id=lib_val)}
    results = []
    for r in recents:
        b = lib_books.get(r["book_id"])
        if b:
            if format_val and format_val in ("pdf", "epub"):
                if b.get("format") != format_val and not b.get("path", "").lower().endswith(f".{format_val}"):
                    continue
            b_copy = dict(b)
            r_pct = r.get("percent", 0)
            r_cfi = r.get("cfi")
            if (r_pct is None or r_pct <= 0) and r_cfi and b.get("path") and b["path"].lower().endswith(".epub"):
                est = scanner.estimate_epub_percent(b["path"], r_cfi)
                if est is not None and est > 0:
                    r_pct = est
                    tracker._data[r["book_id"]]["percent"] = est
                    tracker._save()
            elif not r_cfi and r.get("total_pages", 0) > 1 and r.get("page", 0) > 0:
                calc_pct = round((r["page"] / r["total_pages"]) * 100, 1)
                if abs((r_pct or 0) - calc_pct) > 0.5:
                    r_pct = calc_pct
                    tracker._data[r["book_id"]]["percent"] = calc_pct
                    tracker._save()

            prog = {
                "page": r.get("page", 1),
                "total_pages": r.get("total_pages", 100),
                "percent": r_pct,
                "status": r.get("status", "in_progress"),
                "zoom": r.get("zoom", 1.2),
                "invert_colors": r.get("invert_colors", False),
                "updated_at": r.get("updated_at", "")
            }
            if r_cfi:
                prog["cfi"] = r_cfi
            b_copy["progress"] = prog
            b_copy["cover_url"] = f"/api/cover/{b['id']}"
            b_copy["is_favorite"] = favorites_mgr.is_favorite(b["id"])
            b_copy["tags"] = tags_mgr.get_book_tags(b["id"])
            results.append(b_copy)
            if len(results) >= 10:
                break
    return {"books": results}

@router.post("/api/progress")
def save_progress(
    payload: ProgressPayload,
    user: str = Depends(get_request_user),
    scanner: LibraryScanner = Depends(get_scanner),
    user_mgr: UserManager = Depends(get_user_mgr)
):
    """Saves the current reading page/cfi, zoom, and night reading mode for a book."""
    tracker = user_mgr.get_tracker(user)

    pct = payload.percent
    if (pct is None or pct <= 0) and payload.cfi:
        b = scanner.find_book(payload.book_id)
        if b and b.get("path") and b["path"].lower().endswith(".epub"):
            est = scanner.estimate_epub_percent(b["path"], payload.cfi)
            if est is not None and est > 0:
                pct = est

    record = tracker.set_progress(
        payload.book_id, 
        payload.page, 
        payload.total_pages, 
        payload.zoom,
        payload.invert_colors,
        payload.cfi,
        pct
    )
    return {"status": "ok", "progress": record}

@router.post("/api/book/zoom")
def save_zoom(
    payload: ZoomPayload,
    user: str = Depends(get_request_user),
    user_mgr: UserManager = Depends(get_user_mgr)
):
    """Saves the preferred zoom level for a book."""
    tracker = user_mgr.get_tracker(user)
    record = tracker.set_zoom(payload.book_id, payload.zoom)
    return {"status": "ok", "record": record}

@router.post("/api/book/night-mode")
def save_night_mode(
    payload: NightModePayload,
    user: str = Depends(get_request_user),
    user_mgr: UserManager = Depends(get_user_mgr)
):
    """Saves the preferred night reading mode (invert colors) for a book."""
    tracker = user_mgr.get_tracker(user)
    record = tracker.set_night_mode(payload.book_id, payload.invert_colors)
    return {"status": "ok", "record": record}

@router.post("/api/book/status")
def update_book_status(
    payload: StatusPayload,
    user: str = Depends(get_request_user),
    scanner: LibraryScanner = Depends(get_scanner),
    user_mgr: UserManager = Depends(get_user_mgr)
):
    """Marks a book as not started or completed."""
    tracker = user_mgr.get_tracker(user)

    b = scanner.find_book(payload.book_id)
    if not b:
        raise HTTPException(status_code=404, detail="Book not found")

    if payload.status == "not_started":
        rec = tracker.reset_progress(payload.book_id)
        return {
            "status": "ok",
            "progress": rec
        }
    elif payload.status == "completed":
        is_epub = b.get("format") == "epub" or b["path"].lower().endswith(".epub")
        total_pages = 100 if is_epub else 1
        if not is_epub:
            try:
                pdf = pdfium.PdfDocument(b["path"])
                total_pages = len(pdf)
                pdf.close()
            except Exception as e:
                print(f"Could not read total pages for {b['title']}: {e}")

        rec = tracker.mark_completed(payload.book_id, total_pages)
        return {"status": "ok", "progress": rec}
    else:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'not_started' or 'completed'")

@router.get("/api/book/{book_id}")
def get_book(
    book_id: str,
    user: str = Depends(get_request_user),
    scanner: LibraryScanner = Depends(get_scanner),
    user_mgr: UserManager = Depends(get_user_mgr)
):
    """Returns details for a single book enriched with reading stats, annotations, and metadata."""
    tracker = user_mgr.get_tracker(user)
    favorites_mgr = user_mgr.get_favorites_mgr(user)
    tags_mgr = user_mgr.get_tags_mgr(user)
    annotations_mgr = user_mgr.get_annotations_mgr(user)

    b = scanner.find_book(book_id)
    if not b:
        raise HTTPException(status_code=404, detail="Book not found")
    b_copy = dict(b)
    prog = tracker.get_progress(book_id)
    if prog:
        p_pct = prog.get("percent", 0)
        p_cfi = prog.get("cfi")
        if (p_pct is None or p_pct <= 0) and p_cfi and b.get("path") and b["path"].lower().endswith(".epub"):
            est = scanner.estimate_epub_percent(b["path"], p_cfi)
            if est is not None and est > 0:
                prog["percent"] = est
                tracker._data[book_id]["percent"] = est
                tracker._save()
    b_copy["progress"] = prog if prog else {"page": 1, "total_pages": 0, "percent": 0}
    b_copy["cover_url"] = f"/api/cover/{book_id}"
    b_copy["is_favorite"] = favorites_mgr.is_favorite(book_id)
    b_copy["tags"] = tags_mgr.get_book_tags(book_id)

    # Annotations summary
    book_annotations = annotations_mgr.get_annotations(book_id)
    b_copy["annotations"] = book_annotations
    b_copy["annotations_count"] = len(book_annotations)

    # Technical file metadata for PDF
    if b.get("format") == "pdf" and b.get("path") and os.path.isfile(b["path"]):
        try:
            pdf = pdfium.PdfDocument(b["path"])
            total_pages = len(pdf)
            b_copy["total_pages"] = total_pages
            if not b_copy["progress"].get("total_pages") or b_copy["progress"]["total_pages"] <= 1:
                b_copy["progress"]["total_pages"] = total_pages
            meta = pdf.get_metadata_dict()
            if meta:
                raw_auth = meta.get("Author")
                if raw_auth and not b_copy.get("author") and not any(ord(c) < 32 for c in raw_auth):
                    b_copy["author"] = raw_auth.strip()
                raw_subj = meta.get("Subject")
                if raw_subj and raw_subj != "None" and not b_copy.get("description"):
                    b_copy["description"] = raw_subj.strip()
                if meta.get("Creator"):
                    b_copy["creator"] = meta["Creator"].strip()
                if meta.get("CreationDate"):
                    b_copy["creation_date"] = meta["CreationDate"].strip()
            pdf.close()
        except Exception:
            pass

    return b_copy

@router.get("/api/cover/{book_id}")
def get_cover(book_id: str, scanner: LibraryScanner = Depends(get_scanner), cover_mgr: CoverManager = Depends(get_cover_mgr)):
    """Serves the WebP cover thumbnail for a book (generates on-the-fly if needed)."""
    b = scanner.find_book(book_id)
    if not b:
        raise HTTPException(status_code=404, detail="Book not found")

    cover_path = cover_mgr.generate_cover(b["path"], book_id, b["title"])
    return FileResponse(
        cover_path,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=86400"}
    )

@router.get("/api/pdf/{book_id}")
@router.get("/api/epub/{book_id}")
@router.get("/api/epub/{book_id}.epub")
@router.get("/api/book-file/{book_id}")
def stream_book_file(book_id: str, scanner: LibraryScanner = Depends(get_scanner)):
    """Streams the book file (.pdf or .epub) with byte-range support for fast in-browser rendering."""
    clean_id = book_id.removesuffix(".epub").removesuffix(".pdf")
    b = scanner.find_book(clean_id) or scanner.find_book(book_id)
    if not b or not os.path.exists(b["path"]):
        raise HTTPException(status_code=404, detail="Book file not found")

    is_epub = b.get("format") == "epub" or b["path"].lower().endswith(".epub")
    media_type = "application/epub+zip" if is_epub else "application/pdf"

    return FileResponse(
        b["path"],
        media_type=media_type,
        content_disposition_type="inline",
        filename=b["filename"]
    )

@router.get("/api/favorites")
def get_favorites(
    library_id: Optional[str] = Query(None),
    format: Optional[str] = Query(None, description="Filter by book format: pdf, epub"),
    user: str = Depends(get_request_user),
    scanner: LibraryScanner = Depends(get_scanner),
    user_mgr: UserManager = Depends(get_user_mgr)
):
    """Returns list of favorite book IDs and favorite books strictly scoped to library and user."""
    favorites_mgr = user_mgr.get_favorites_mgr(user)
    tracker = user_mgr.get_tracker(user)
    tags_mgr = user_mgr.get_tags_mgr(user)

    lib_val = library_id if isinstance(library_id, str) else None
    format_val = format.lower().strip() if isinstance(format, str) and format.strip() else None
    fav_ids = set(favorites_mgr.get_favorite_ids())
    all_progress = tracker.get_all()
    # Strictly isolate: only books physically belonging to this library
    lib_books = scanner.get_books(library_id=lib_val)
    books = []
    for b in lib_books:
        if b["id"] in fav_ids:
            if format_val and format_val in ("pdf", "epub"):
                if b.get("format") != format_val and not b.get("path", "").lower().endswith(f".{format_val}"):
                    continue
            b_copy = dict(b)
            prog = all_progress.get(b["id"])
            b_copy["progress"] = prog if prog else {"page": 1, "total_pages": 0, "percent": 0}
            b_copy["cover_url"] = f"/api/cover/{b['id']}"
            b_copy["is_favorite"] = True
            b_copy["tags"] = tags_mgr.get_book_tags(b["id"])
            books.append(b_copy)
    return {
        "favorite_ids": [b["id"] for b in books],
        "books": books,
        "count": len(books)
    }

@router.post("/api/favorites/toggle")
def toggle_favorite(
    payload: ToggleFavoritePayload,
    user: str = Depends(get_request_user),
    user_mgr: UserManager = Depends(get_user_mgr)
):
    """Toggles a book's favorite status."""
    favorites_mgr = user_mgr.get_favorites_mgr(user)
    is_fav = favorites_mgr.toggle_favorite(payload.book_id)
    return {
        "status": "ok",
        "book_id": payload.book_id,
        "is_favorite": is_fav,
        "favorite_ids": favorites_mgr.get_favorite_ids()
    }
