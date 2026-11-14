import html
import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse

from ..scanner import LibraryScanner
from ..covers import CoverManager
from ..users import UserManager
from ..deps import get_scanner, get_cover_mgr, get_user_mgr, get_request_user

router = APIRouter(tags=["legacy"])

def _format_size(size_bytes: int) -> str:
    """Format file size in human readable string."""
    if not size_bytes or size_bytes <= 0:
        return ""
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.0f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"

@router.get("/legacy", response_class=HTMLResponse)
def get_legacy_view(
    request: Request,
    shelf: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    sort: Optional[str] = Query("title_asc"),
    library_id: Optional[str] = Query(None),
    user: str = Depends(get_request_user),
    scanner: LibraryScanner = Depends(get_scanner),
    user_mgr: UserManager = Depends(get_user_mgr),
):
    """
    Ultra-lightweight, zero-modern-JS server-rendered shelf interface.
    100% compatible with iOS 9 Safari (WebKit 601), old tablets, and e-readers.
    Uses JPEG covers and native browser PDF/EPUB opening.
    """
    libraries = scanner.config_mgr.get_libraries()
    # Resolve library: query param -> cookie -> active_library_id -> first library -> "default"
    selected_lib_id = library_id or request.cookies.get("uzi_library") or scanner.config_mgr.get_active_library_id()
    if not selected_lib_id and libraries:
        selected_lib_id = libraries[0]["id"]
    active_lib_id = selected_lib_id or "default"

    if libraries and not any(l["id"] == active_lib_id for l in libraries):
        active_lib_id = libraries[0]["id"]

    library_options_html = []
    for l_item in libraries:
        l_name = html.escape(l_item.get("name") or "Library")
        l_id = html.escape(l_item.get("id"))
        is_sel = "selected" if l_id == active_lib_id else ""
        library_options_html.append(f'<option value="{l_id}" {is_sel}>{l_name}</option>')
    
    folders = scanner.get_folders(library_id=active_lib_id)
    all_books = scanner.get_books(library_id=active_lib_id)

    # Multi-user profile handling
    active_user = (user or "default").strip() or "default"
    available_users = user_mgr.list_users()
    if not available_users:
        available_users = [{"username": "default", "slug": "default"}]

    user_options_html = []
    for u_item in available_users:
        u_name = html.escape(u_item.get("username") or u_item.get("slug"))
        u_slug = html.escape(u_item.get("slug"))
        is_sel = "selected" if (u_slug.lower() == active_user.lower() or u_name.lower() == active_user.lower()) else ""
        user_options_html.append(f'<option value="{u_slug}" {is_sel}>{u_name}</option>')

    tracker = user_mgr.get_tracker(active_user)
    favorites_mgr = user_mgr.get_favorites_mgr(active_user)
    all_progress = tracker.get_all()
    fav_ids = set(favorites_mgr.get_favorite_ids())

    # Filter books
    query_str = (q or "").strip().lower()
    selected_shelf = (shelf or "").strip()

    books: List[Dict[str, Any]] = []
    continue_count = 0
    completed_count = 0
    fav_count = 0

    for b in all_books:
        bid = b["id"]
        prog = all_progress.get(bid, {})
        is_fav = bid in fav_ids
        if is_fav:
            fav_count += 1
        
        is_completed = prog.get("status") == "completed" or (prog.get("percent") is not None and float(prog.get("percent", 0)) >= 100)
        is_in_progress = (
            not is_completed
            and prog.get("status") != "not_started"
            and (prog.get("page", 1) > 1 or prog.get("cfi") or prog.get("percent", 0) > 0)
        )

        if is_in_progress:
            continue_count += 1
        if is_completed:
            completed_count += 1

        # Shelf filtering
        if selected_shelf == "__favorites__" and not is_fav:
            continue
        elif selected_shelf == "__continue__" and not is_in_progress:
            continue
        elif selected_shelf == "__completed__" and not is_completed:
            continue
        elif selected_shelf and selected_shelf not in ("__favorites__", "__continue__", "__completed__"):
            b_folder = b.get("folder", "")
            b_shelf = b.get("shelf", "")
            if b_folder != selected_shelf and b_shelf != selected_shelf:
                continue

        # Search query filter
        if query_str:
            title_match = query_str in b.get("title", "").lower()
            author_match = query_str in b.get("author", "").lower()
            file_match = query_str in b.get("filename", "").lower()
            if not (title_match or author_match or file_match):
                continue

        b_item = dict(b)
        b_item["progress"] = prog
        b_item["is_favorite"] = is_fav
        b_item["is_completed"] = is_completed
        b_item["is_in_progress"] = is_in_progress
        books.append(b_item)

    # Sort books
    sort_key = (sort or "title_asc").lower()
    if sort_key == "title_desc":
        books.sort(key=lambda x: x.get("title", "").lower(), reverse=True)
    elif sort_key == "size_desc":
        books.sort(key=lambda x: x.get("size", 0), reverse=True)
    elif sort_key == "recent":
        books.sort(key=lambda x: x.get("progress", {}).get("updated_at", ""), reverse=True)
    else:
        books.sort(key=lambda x: x.get("title", "").lower())

    # Build Shelves Pills HTML
    all_active = "active" if not selected_shelf else ""
    cont_active = "active" if selected_shelf == "__continue__" else ""
    comp_active = "active" if selected_shelf == "__completed__" else ""
    fav_active = "active" if selected_shelf == "__favorites__" else ""

    pills_html = [
        f'<a href="/legacy?sort={sort_key}&user={html.escape(active_user)}&library_id={html.escape(active_lib_id)}" class="shelf-pill {all_active}">All Books ({len(all_books)})</a>',
        f'<a href="/legacy?shelf=__continue__&sort={sort_key}&user={html.escape(active_user)}&library_id={html.escape(active_lib_id)}" class="shelf-pill {cont_active}">Continue ({continue_count})</a>',
        f'<a href="/legacy?shelf=__completed__&sort={sort_key}&user={html.escape(active_user)}&library_id={html.escape(active_lib_id)}" class="shelf-pill {comp_active}">Completed ({completed_count})</a>',
        f'<a href="/legacy?shelf=__favorites__&sort={sort_key}&user={html.escape(active_user)}&library_id={html.escape(active_lib_id)}" class="shelf-pill {fav_active}">Favorites ({fav_count})</a>',
    ]

    for f in folders:
        f_name = f.get("custom_name") or f.get("name") or "Unnamed"
        f_id = f.get("id") or f.get("name")
        f_active = "active" if selected_shelf == f_id or selected_shelf == f.get("name") else ""
        pills_html.append(
            f'<a href="/legacy?shelf={html.escape(f_id)}&sort={sort_key}&user={html.escape(active_user)}&library_id={html.escape(active_lib_id)}" class="shelf-pill {f_active}">{html.escape(f_name)} ({f.get("book_count", 0)})</a>'
        )

    # Build Books HTML
    books_cards_html = []
    for b in books:
        bid = b["id"]
        btitle = html.escape(b.get("title") or b.get("filename") or "Untitled")
        bauthor = html.escape(b.get("author") or "")
        bsize = _format_size(b.get("size", 0))
        is_epub = b.get("format") == "epub" or b.get("path", "").lower().endswith(".epub")
        fmt_badge = "EPUB" if is_epub else "PDF"
        fmt_class = "badge-epub" if is_epub else "badge-pdf"

        # Read URL & Actions
        if is_epub:
            read_url = f"/api/epub/{bid}.epub"
            read_btn_label = "📖 Open in iBooks"
            download_url = f"/api/book-file/{bid}"
        else:
            read_url = f"/api/pdf/{bid}"
            read_btn_label = "📖 Read PDF"
            download_url = f"/api/book-file/{bid}"

        # Progress bar
        prog = b.get("progress") or {}
        pct = prog.get("percent", 0)
        page = prog.get("page", 1)
        total_p = prog.get("total_pages", 0)
        prog_html = ""
        if b.get("is_completed"):
            prog_html = '''
            <div class="progress-box">
                <div class="progress-track"><div class="progress-fill" style="width: 100%; background-color: #10b981;"></div></div>
                <div class="progress-label" style="color: #34d399;">✓ Completed</div>
            </div>
            '''
        elif b.get("is_in_progress"):
            pct_val = min(100, max(0, round(pct, 1)))
            p_text = f"Page {page}"
            if total_p > 0:
                p_text += f" / {total_p}"
            p_text += f" ({pct_val}%)"
            prog_html = f'''
            <div class="progress-box">
                <div class="progress-track"><div class="progress-fill" style="width: {pct_val}%;"></div></div>
                <div class="progress-label">{p_text}</div>
            </div>
            '''

        author_html = f'<div class="book-author">{bauthor}</div>' if bauthor else ""
        size_html = f'<span class="book-size">{bsize}</span>' if bsize else ""

        card_html = f'''
        <div class="book-card" data-title="{btitle.lower()}" data-author="{bauthor.lower()}">
            <div class="cover-wrapper">
                <a href="{read_url}" target="_blank">
                    <img src="/api/cover/{bid}?format=jpg" alt="{btitle}" class="book-cover" onerror="this.style.display=\'none\';" />
                </a>
                <span class="badge {fmt_class}">{fmt_badge}</span>
            </div>
            <div class="book-info">
                <div class="book-title" title="{btitle}">{btitle}</div>
                {author_html}
                <div class="book-meta">
                    {size_html}
                </div>
                {prog_html}
                <div class="book-actions">
                    <a href="{read_url}" target="_blank" class="btn btn-primary">{read_btn_label}</a>
                    <a href="{download_url}" download="{html.escape(b.get('filename', 'book'))}" class="btn btn-secondary">⬇ Download</a>
                </div>
            </div>
        </div>
        '''
        books_cards_html.append(card_html)

    books_content = "\n".join(books_cards_html) if books_cards_html else '<div class="empty-msg">No books found in this selection.</div>'

    html_page = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
    <title>Uzi Library - Legacy Mode</title>
    <style>
        /* Standalone, 100% iOS 9 / Safari WebKit 601 compatible CSS */
        * {{ -webkit-box-sizing: border-box; box-sizing: border-box; }}
        body {{
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #121214;
            color: #e1e1e6;
            -webkit-text-size-adjust: 100%;
        }}
        header {{
            background-color: #1a1a1e;
            border-bottom: 1px solid #2a2a30;
            padding: 12px 16px;
            position: -webkit-sticky;
            position: sticky;
            top: 0;
            z-index: 100;
        }}
        .header-top {{
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            -webkit-box-pack: justify;
            -webkit-justify-content: space-between;
            justify-content: space-between;
            -webkit-box-align: center;
            -webkit-align-items: center;
            align-items: center;
            margin-bottom: 10px;
        }}
        .brand {{
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
            text-decoration: none;
            display: -webkit-box;
            display: flex;
            -webkit-box-align: center;
            align-items: center;
        }}
        .brand-sub {{
            font-size: 11px;
            background-color: #3b3b44;
            color: #a1a1aa;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 8px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }}
        .brand-and-selectors {{
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            -webkit-flex-wrap: wrap;
            flex-wrap: wrap;
            -webkit-box-align: center;
            -webkit-align-items: center;
            align-items: center;
            gap: 10px;
        }}
        .selectors-group {{
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            -webkit-flex-wrap: wrap;
            flex-wrap: wrap;
            -webkit-box-align: center;
            -webkit-align-items: center;
            align-items: center;
            gap: 8px;
        }}
        .selector-form, .profile-form {{
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            -webkit-box-align: center;
            -webkit-align-items: center;
            align-items: center;
            background-color: #24242a;
            border: 1px solid #363640;
            border-radius: 6px;
            padding: 2px 8px;
        }}
        .selector-icon, .profile-icon {{
            font-size: 13px;
            margin-right: 4px;
        }}
        .selector-select, .profile-select {{
            background: transparent;
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
            border: none;
            outline: none;
            cursor: pointer;
            padding: 2px 0;
            -webkit-appearance: menulist;
            max-width: 170px;
        }}
        .modern-link {{
            color: #818cf8;
            font-size: 13px;
            text-decoration: none;
            padding: 6px 10px;
            border: 1px solid #4338ca;
            border-radius: 6px;
            background-color: rgba(99, 102, 241, 0.1);
        }}
        .search-row {{
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }}
        .search-input {{
            -webkit-box-flex: 1;
            -webkit-flex: 1;
            flex: 1;
            background-color: #24242a;
            border: 1px solid #363640;
            color: #ffffff;
            font-size: 16px; /* 16px prevents iOS auto-zoom */
            padding: 8px 12px;
            border-radius: 6px;
            outline: none;
        }}
        .search-btn {{
            background-color: #4f46e5;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            padding: 8px 14px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
        }}
        .shelves-container {{
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            white-space: nowrap;
            padding-bottom: 6px;
            margin-top: 4px;
        }}
        .shelf-pill {{
            display: inline-block;
            background-color: #24242a;
            color: #a1a1aa;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            padding: 5px 12px;
            border-radius: 16px;
            margin-right: 6px;
            border: 1px solid #32323a;
        }}
        .shelf-pill.active {{
            background-color: #4f46e5;
            color: #ffffff;
            border-color: #6366f1;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 16px;
        }}
        .books-grid {{
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            -webkit-flex-wrap: wrap;
            flex-wrap: wrap;
            margin: -8px;
        }}
        .book-card {{
            width: 50%;
            padding: 8px;
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            -webkit-box-orient: vertical;
            -webkit-flex-direction: column;
            flex-direction: column;
        }}
        @media (min-width: 600px) {{
            .book-card {{ width: 33.333%; }}
        }}
        @media (min-width: 900px) {{
            .book-card {{ width: 25%; }}
        }}
        .cover-wrapper {{
            position: relative;
            background-color: #1a1a1e;
            border-radius: 8px 8px 0 0;
            overflow: hidden;
            text-align: center;
            min-height: 180px;
            display: -webkit-box;
            display: flex;
            -webkit-box-align: center;
            align-items: center;
            -webkit-box-pack: center;
            justify-content: center;
            border: 1px solid #2a2a30;
            border-bottom: none;
        }}
        .book-cover {{
            width: 100%;
            max-height: 240px;
            display: block;
            object-fit: cover;
            background-color: #1e1e24;
        }}
        .badge {{
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            letter-spacing: 0.5px;
            color: #ffffff;
        }}
        .badge-pdf {{ background-color: #dc2626; }}
        .badge-epub {{ background-color: #059669; }}
        .book-info {{
            background-color: #1e1e24;
            border: 1px solid #2a2a30;
            border-radius: 0 0 8px 8px;
            padding: 12px;
            -webkit-box-flex: 1;
            -webkit-flex: 1;
            flex: 1;
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            -webkit-box-orient: vertical;
            -webkit-flex-direction: column;
            flex-direction: column;
            -webkit-box-pack: justify;
            -webkit-justify-content: space-between;
            justify-content: space-between;
        }}
        .book-title {{
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 4px;
            line-height: 1.3;
            max-height: 2.6em;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }}
        .book-author {{
            font-size: 12px;
            color: #a1a1aa;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }}
        .book-meta {{
            font-size: 11px;
            color: #71717a;
            margin-bottom: 8px;
        }}
        .progress-box {{
            margin-bottom: 10px;
        }}
        .progress-track {{
            background-color: #2a2a32;
            height: 4px;
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 4px;
        }}
        .progress-fill {{
            background-color: #6366f1;
            height: 100%;
        }}
        .progress-label {{
            font-size: 10px;
            color: #818cf8;
            font-weight: 500;
        }}
        .book-actions {{
            display: -webkit-box;
            display: -webkit-flex;
            display: flex;
            -webkit-box-orient: vertical;
            -webkit-flex-direction: column;
            flex-direction: column;
            gap: 6px;
            margin-top: 6px;
        }}
        .btn {{
            display: block;
            text-align: center;
            text-decoration: none;
            padding: 8px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            min-height: 34px;
            line-height: 18px;
            -webkit-tap-highlight-color: transparent;
        }}
        .btn-primary {{
            background-color: #4f46e5;
            color: #ffffff;
        }}
        .btn-primary:active {{
            background-color: #4338ca;
        }}
        .btn-secondary {{
            background-color: #2a2a32;
            color: #d4d4d8;
            border: 1px solid #3a3a44;
        }}
        .btn-secondary:active {{
            background-color: #363642;
        }}
        .empty-msg {{
            text-align: center;
            padding: 40px 16px;
            color: #71717a;
            font-size: 15px;
            width: 100%;
        }}
    </style>
</head>
<body>
    <header>
        <div class="header-top">
            <div class="brand-and-selectors">
                <a href="/legacy?user={html.escape(active_user)}&library_id={html.escape(active_lib_id)}" class="brand">
                    📚 Uzi Library
                    <span class="brand-sub">LEGACY</span>
                </a>
                <div class="selectors-group">
                    <form method="GET" action="/legacy" class="selector-form">
                        <input type="hidden" name="user" value="{html.escape(active_user)}" />
                        <input type="hidden" name="sort" value="{html.escape(sort_key)}" />
                        <span class="selector-icon">📖</span>
                        <select name="library_id" class="selector-select" onchange="this.form.submit()">
                            {''.join(library_options_html)}
                        </select>
                    </form>
                    <form method="GET" action="/legacy" class="selector-form">
                        <input type="hidden" name="library_id" value="{html.escape(active_lib_id)}" />
                        <input type="hidden" name="shelf" value="{html.escape(selected_shelf)}" />
                        <input type="hidden" name="sort" value="{html.escape(sort_key)}" />
                        <input type="hidden" name="q" value="{html.escape(q or '')}" />
                        <span class="selector-icon">👤</span>
                        <select name="user" class="selector-select" onchange="this.form.submit()">
                            {''.join(user_options_html)}
                        </select>
                    </form>
                </div>
            </div>
            <a href="/" class="modern-link">Switch to Modern View →</a>
        </div>
        <form method="GET" action="/legacy" class="search-row" id="search-form">
            <input type="hidden" name="user" value="{html.escape(active_user)}" />
            <input type="hidden" name="library_id" value="{html.escape(active_lib_id)}" />
            <input type="hidden" name="shelf" value="{html.escape(selected_shelf)}" />
            <input type="hidden" name="sort" value="{html.escape(sort_key)}" />
            <input type="text" name="q" id="search-input" class="search-input" placeholder="Search books by title or author..." value="{html.escape(q or '')}" autocomplete="off" />
            <button type="submit" class="search-btn">Search</button>
        </form>
        <div class="shelves-container">
            {''.join(pills_html)}
        </div>
    </header>

    <div class="container">
        <div class="books-grid" id="books-grid">
            {books_content}
        </div>
    </div>

    <script>
        // Simple ES3/ES5 live search for old Safari
        (function() {{
            var searchInput = document.getElementById('search-input');
            var cards = document.getElementsByClassName('book-card');
            if (!searchInput || !cards.length) return;

            function filterCards() {{
                var term = searchInput.value.toLowerCase().replace(/^\\s+|\\s+$/g, '');
                for (var i = 0; i < cards.length; i++) {{
                    var card = cards[i];
                    var title = card.getAttribute('data-title') || '';
                    var author = card.getAttribute('data-author') || '';
                    if (!term || title.indexOf(term) !== -1 || author.indexOf(term) !== -1) {{
                        card.style.display = '';
                    }} else {{
                        card.style.display = 'none';
                    }}
                }}
            }}

            if (searchInput.addEventListener) {{
                searchInput.addEventListener('input', filterCards, false);
            }} else if (searchInput.attachEvent) {{
                searchInput.attachEvent('onkeyup', filterCards);
            }}
        }})();
    </script>
</body>
</html>
'''
    response = HTMLResponse(content=html_page)
    response.set_cookie(key="uzi_user", value=active_user, max_age=31536000, path="/", samesite="lax")
    response.set_cookie(key="uzi_library", value=active_lib_id, max_age=31536000, path="/", samesite="lax")
    return response
