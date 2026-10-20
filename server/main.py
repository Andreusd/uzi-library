import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .scanner import LibraryScanner
from .annotations import AnnotationsManager
from .favorites import FavoritesManager
from .lookup import LookupManager
from .users import UserManager
from .deps import (
    get_scanner,
    get_cover_mgr,
    get_lookup_mgr,
    get_user_mgr,
)

# Re-export schemas for backward compatibility
from .schemas import (
    ProgressPayload,
    ZoomPayload,
    NightModePayload,
    StatusPayload,
    RenameShelfPayload,
    SetShelfIconPayload,
    ToggleFavoritePayload,
    SettingsPayload,
    DisplaySettingsPayload,
    ValidatePathPayload,
    AddLibraryPayload,
    UpdateLibraryPayload,
    SetActiveLibraryPayload,
    AnnotationPayload,
    UpdateAnnotationPayload,
    TranslatePayload,
    CreateTagPayload,
    UpdateTagPayload,
    SetBookTagsPayload,
    ToggleBookTagPayload,
    UserPayload,
)

# Modular Routers
from .routers.users import router as users_router
from .routers.libraries import router as libraries_router
from .routers.books import router as books_router
from .routers.tags import router as tags_router
from .routers.lookup import router as lookup_router

# Base paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENT_DIST = os.path.abspath(os.path.join(BASE_DIR, "..", "client", "dist"))

# Core components via dependency injection
scanner = get_scanner()
cover_mgr = get_cover_mgr()
lookup_mgr = get_lookup_mgr()
user_mgr = get_user_mgr()

from .tray import start_tray_in_background, stop_tray, record_activity

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-cache covers for all configured libraries on startup
    active_scanner = get_scanner()
    active_cover_mgr = get_cover_mgr()
    all_books = []
    for lib in active_scanner.config_mgr.get_libraries():
        lib_books = active_scanner.get_books(library_id=lib["id"])
        all_books.extend(lib_books)
    print(f"Discovered {len(all_books)} books across {len(active_scanner.config_mgr.get_libraries())} libraries.")
    active_cover_mgr.pre_cache_all(all_books)

    # Start system tray indicator in background
    start_tray_in_background(port=8000)

    yield

    stop_tray()

app = FastAPI(title="Uzi Library API", lifespan=lifespan)

# Track client user activity for system tray status (2-minute activity window)
@app.middleware("http")
async def track_activity_middleware(request: Request, call_next):
    record_activity()
    return await call_next(request)

# Allow CORS for development Vite server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Modular Sub-Routers
app.include_router(users_router)
app.include_router(libraries_router)
app.include_router(books_router)
app.include_router(tags_router)
app.include_router(lookup_router)

# If client production build exists, mount static assets and index.html fallback
if os.path.exists(CLIENT_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(CLIENT_DIST, "assets")), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(CLIENT_DIST, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Endpoint not found")
        file_path = os.path.join(CLIENT_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(CLIENT_DIST, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host="0.0.0.0", port=8000, reload=True)
