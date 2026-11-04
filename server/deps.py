"""
Dependency injection providers for FastAPI routes.
Provides clean dependency isolation for LibraryScanner, CoverManager, LookupManager, and UserManager.
"""
from typing import Optional
from fastapi import Request
from .scanner import LibraryScanner
from .covers import CoverManager
from .lookup import LookupManager
from .users import UserManager
from .ai.manager import AIManager

_scanner_instance: Optional[LibraryScanner] = None
_cover_mgr_instance: Optional[CoverManager] = None
_lookup_mgr_instance: Optional[LookupManager] = None
_user_mgr_instance: Optional[UserManager] = None
_ai_mgr_instance: Optional[AIManager] = None

def get_scanner() -> LibraryScanner:
    """Returns the singleton LibraryScanner instance or test override."""
    global _scanner_instance
    if _scanner_instance is None:
        _scanner_instance = LibraryScanner()
    return _scanner_instance

def get_cover_mgr() -> CoverManager:
    """Returns the singleton CoverManager instance or test override."""
    global _cover_mgr_instance
    if _cover_mgr_instance is None:
        _cover_mgr_instance = CoverManager()
    return _cover_mgr_instance

def get_lookup_mgr() -> LookupManager:
    """Returns the singleton LookupManager instance or test override."""
    global _lookup_mgr_instance
    if _lookup_mgr_instance is None:
        _lookup_mgr_instance = LookupManager()
    return _lookup_mgr_instance

def get_user_mgr() -> UserManager:
    """Returns the singleton UserManager instance or test override."""
    global _user_mgr_instance
    if _user_mgr_instance is None:
        _user_mgr_instance = UserManager()
    return _user_mgr_instance

def get_ai_mgr() -> AIManager:
    """Returns the singleton AIManager instance or test override."""
    global _ai_mgr_instance
    if _ai_mgr_instance is None:
        _ai_mgr_instance = AIManager()
    return _ai_mgr_instance

def get_request_user(request: Request) -> str:
    """Extracts username from X-User header or user query param."""
    x_user = request.headers.get("x-user") or request.headers.get("X-User")
    if not x_user:
        x_user = request.query_params.get("user")
    return (x_user or "default").strip() or "default"

def set_scanner_override(scanner: Optional[LibraryScanner]):
    global _scanner_instance
    _scanner_instance = scanner

def set_cover_mgr_override(cover_mgr: Optional[CoverManager]):
    global _cover_mgr_instance
    _cover_mgr_instance = cover_mgr

def set_lookup_mgr_override(lookup_mgr: Optional[LookupManager]):
    global _lookup_mgr_instance
    _lookup_mgr_instance = lookup_mgr

def set_user_mgr_override(user_mgr: Optional[UserManager]):
    global _user_mgr_instance
    _user_mgr_instance = user_mgr

def reset_overrides():
    """Resets all dependency singletons back to None so they reinitialize normally."""
    global _scanner_instance, _cover_mgr_instance, _lookup_mgr_instance, _user_mgr_instance
    _scanner_instance = None
    _cover_mgr_instance = None
    _lookup_mgr_instance = None
    _user_mgr_instance = None

