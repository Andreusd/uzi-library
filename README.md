# 📚 Uzi Library

A modern, fast, responsive, and lightweight application to organize, browse, and read your personal collection of PDF books.

[![Latest Release](https://img.shields.io/github/v/release/Andreusd/uzi-library?color=blue&label=Release)](https://github.com/Andreusd/uzi-library/releases/latest)
[![Windows App](https://img.shields.io/badge/Windows-Standalone_.exe-0078D6?logo=windows)](https://github.com/Andreusd/uzi-library/releases/latest/download/UziLibrary.exe)
[![Android App](https://img.shields.io/badge/Android-Installable_.apk-3DDC84?logo=android)](https://github.com/Andreusd/uzi-library/releases/latest/download/UziLibrary.apk)

---

## 📥 Downloads (Standalone & Mobile Apps)

Você pode baixar os aplicativos compilados diretamente da aba de [Releases do GitHub](https://github.com/Andreusd/uzi-library/releases/latest):

* 🪟 **[UziLibrary.exe (Windows Standalone)](https://github.com/Andreusd/uzi-library/releases/latest/download/UziLibrary.exe)**: Aplicativo desktop portátil com Tauri v2, aceleração por GPU e micro-proxy com cache offline local embutido. Não precisa de instalação.
* 📱 **[UziLibrary.apk (Android)](https://github.com/Andreusd/uzi-library/releases/latest/download/UziLibrary.apk)**: Aplicativo Android empacotado para leitura em tablets e celulares conectados ao servidor local.

---

## 🚀 Quick Start / Como Executar

### Windows (Quick Launch)
Double click:
```cmd
run.bat
```

### Linux / macOS
```bash
./run.sh
```

### Terminal
```bash
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000
```
Open your browser at:
- **Local (this PC)**: **[http://localhost:8000](http://localhost:8000)**
- **LAN (other devices)**: **`http://<YOUR_LOCAL_IP>:8000`**

---

## 🔔 Inicialização com o Computador & Ícone na Bandeja (System Tray)

O **Uzi Library** inclui suporte a ícone na bandeja do sistema (system tray) com o ícone de um livro aberto, além de scripts para iniciar automaticamente junto com o computador no Linux e no Windows:

### 🐧 Linux (systemd user service)
Para configurar para bootar automaticamente junto com o sistema:
```bash
./scripts/install-service.sh
```
* **Bandeja Nativa**: Integração com GNOME Shell, KDE Plasma e Wayland via StatusNotifierItem/AppIndicator.
* **Ações na Bandeja**: Abrir no navegador, abrir pasta de livros, ver logs em tempo real (`journalctl`), reiniciar ou parar o serviço.
* **Comandos úteis**:
  ```bash
  systemctl --user status uzi-library.service
  systemctl --user restart uzi-library.service
  systemctl --user stop uzi-library.service
  ```

### 🪟 Windows (Startup Shortcut & Tray)
Para iniciar automaticamente com o Windows em segundo plano:
1. Execute o script:
   ```cmd
   scripts\install_windows_startup.bat
   ```
2. O atalho é criado na pasta de Inicialização do Windows (`%APPDATA%\...\Startup`), rodando de forma silenciosa com o ícone do livro na bandeja do sistema (Taskbar Notification Area).
3. Para desativar a inicialização automática, execute `scripts\uninstall_windows_startup.bat`.

---

## ⚙️ Library Folder Configuration / Configuração da Pasta de Livros

You can point the application to **any folder on your computer** where your PDF books are stored:
1. Click the **⚙️ Settings** button in the top navigation bar.
2. Enter your books directory path (e.g. `D:\Books`, `C:\Users\You\Documents\Books`, or `/home/user/books`).
3. The app will validate the directory live and display the number of detected books and shelves.
4. Click **Save & Rescan**—your library will load and persist across sessions in `.cache/config.json`.

Alternatively, configure the path via environment variable:
```bash
export BOOK_LIBRARY_PATH="/path/to/your/books"
```

> [!NOTE]
> **Source Folder Safety (100% Read-Only)**:
> The application will **never** alter, write to, or delete your source book files. All generated covers, virtual shelf aliases, and reading progress records are stored locally in the isolated `.cache/` folder.

---

## ✨ Features / Recursos

* **Customizable & Portable Library**: Point to any folder of PDFs on any machine; works with categorized subfolders or direct PDFs.
* **Explorer-Fidelity WebP Covers**: Automatically extracts high-resolution page-1 thumbnails using Google PDFium (`pypdfium2`).
* **Virtual Shelf Renaming**: Right-click any shelf in the sidebar to give it a custom display name without altering the filesystem.
* **Embedded Fullscreen PDF Reader**:
  * **Text Selection & Copy**: Highlight and copy text directly from the PDF page (`Ctrl + C`).
  * **Interactive Links**: Clickable Table of Contents destinations jump to chapters; external links open safely in a new tab.
  * **Per-Book Zoom Memory**: Remembers your preferred zoom factor for each book.
  * **Ctrl + Wheel Smooth Zoom**: Zoom seamlessly inside the viewer without scaling the browser page.
  * **Night Mode**: Instant high-contrast dark reading mode.
* **Reading Progress & "Continue Reading"**:
  * Tracks current page and reading percentage.
  * Books advance to the *Continue Reading* shelf only after reading beyond page 1 (covers don't mark books as started).
  * Right-click any book to *Mark as Not Started* (instantly removes from Continue Reading) or *Mark as Completed*.
* **Bilingual UI (EN / PT)**: Switch between English and Portuguese with a single click in the header.
* **Responsive Toggleable Sidebar**: Smooth sidebar collapse with `Ctrl + B` and backdrop overlay on mobile.
* **Instant Global Search & Sorting**: Press `/` to search titles in real time, or sort by name, file size, or recent reading.

---

## ⌨️ Keyboard Shortcuts / Atalhos do Teclado

| Key / Tecla | Action / Ação |
| :--- | :--- |
| `/` | Focus search bar / Focar na barra de busca |
| `Ctrl + B` | Toggle sidebar / Alternar menu lateral |
| `Right Arrow` / `Space` / `Page Down` | Next page in reader / Próxima página no leitor |
| `Left Arrow` / `Page Up` | Previous page in reader / Página anterior no leitor |
| `Up Arrow` / `Down Arrow` | Scroll page up/down (pure scrolling) / Rolar página para cima/baixo (rolagem suave) |
| `Trackpad 2-Finger Swipe (Left / Right)` | Flip to Next / Previous page / Virar para Próxima / Anterior |
| `+` / `-` | Zoom in / Zoom out |
| `Ctrl + Scroll Wheel` | PDF smooth zoom / Zoom suave do PDF |
| `Esc` | Close reader & return to library / Voltar à estante |

---

## 🛠️ Tech Stack

* **Backend**: Python 3.10+, FastAPI, Uvicorn, PyPDFium2, Pillow.
* **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React, PDF.js.
