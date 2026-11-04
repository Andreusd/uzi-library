from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class ProgressPayload(BaseModel):
    book_id: str
    page: int = 1
    total_pages: int = 1
    zoom: Optional[float] = None
    invert_colors: Optional[bool] = None
    cfi: Optional[str] = None
    percent: Optional[float] = None

class ZoomPayload(BaseModel):
    book_id: str
    zoom: float

class NightModePayload(BaseModel):
    book_id: str
    invert_colors: bool

class StatusPayload(BaseModel):
    book_id: str
    status: str  # "not_started" | "completed"

class RenameShelfPayload(BaseModel):
    shelf_id: Optional[str] = None
    folder_id: Optional[str] = None
    custom_name: str
    library_id: Optional[str] = None

class SetShelfIconPayload(BaseModel):
    shelf_id: Optional[str] = None
    folder_id: Optional[str] = None
    icon: str
    library_id: Optional[str] = None

class ToggleFavoritePayload(BaseModel):
    book_id: str

class SettingsPayload(BaseModel):
    library_path: str

class DisplaySettingsPayload(BaseModel):
    show_file_extension: Optional[bool] = None
    book_animations: Optional[bool] = None

class ValidatePathPayload(BaseModel):
    path: str

class AddLibraryPayload(BaseModel):
    name: str
    path: str
    set_active: Optional[bool] = False

class UpdateLibraryPayload(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None

class SetActiveLibraryPayload(BaseModel):
    library_id: str

class AnnotationPayload(BaseModel):
    book_id: str
    page: Optional[int] = 1
    cfi: Optional[str] = None
    chapter: Optional[str] = None
    text: str
    color: str = "yellow"
    comment: Optional[str] = ""
    rects: Optional[List[Dict[str, Any]]] = []

class UpdateAnnotationPayload(BaseModel):
    comment: Optional[str] = None
    color: Optional[str] = None

class TranslatePayload(BaseModel):
    text: str
    target_lang: Optional[str] = "pt"
    source_lang: Optional[str] = "auto"

class CreateTagPayload(BaseModel):
    name: str
    color: Optional[str] = "amber"
    library_id: Optional[str] = None

class UpdateTagPayload(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class SetBookTagsPayload(BaseModel):
    tag_ids: List[str]

class ToggleBookTagPayload(BaseModel):
    tag_id: str

class UserPayload(BaseModel):
    username: str

class AIChatMessage(BaseModel):
    role: str = "user"  # "user" | "assistant" | "system"
    content: str

class AIContextSnippet(BaseModel):
    text: str
    location: Optional[str] = None
    page: Optional[int] = None

class AIChatPayload(BaseModel):
    messages: List[AIChatMessage]
    conversation_id: Optional[str] = None
    book_id: Optional[str] = None
    book_title: Optional[str] = None
    book_author: Optional[str] = None
    location: Optional[str] = None
    page: Optional[int] = None
    contexts: Optional[List[AIContextSnippet]] = []
    stream: Optional[bool] = True
    system_prompt: Optional[str] = None

class CreateAIConversationPayload(BaseModel):
    book_id: str
    title: Optional[str] = None
    location: Optional[str] = None

class UpdateAIConversationPayload(BaseModel):
    title: str


