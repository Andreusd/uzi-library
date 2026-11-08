mod config;
mod proxy;

use std::path::Path;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};

use config::{resolve_cache_dir, AppConfig, WindowState};
use proxy::ProxyServer;

#[allow(dead_code)]
struct AppState {
    pub cache_dir: std::path::PathBuf,
}

#[tauri::command]
fn toggle_fullscreen(window: WebviewWindow) {
    if let Ok(is_fs) = window.is_fullscreen() {
        let _ = window.set_fullscreen(!is_fs);
    }
}

fn save_window_state(window: &WebviewWindow, cache_dir: &Path) {
    let maximized = window.is_maximized().unwrap_or(false);
    let mut state = WindowState {
        maximized,
        ..Default::default()
    };

    if !maximized {
        if let Ok(pos) = window.outer_position() {
            state.x = Some(pos.x);
            state.y = Some(pos.y);
        }
        if let Ok(size) = window.inner_size() {
            if size.width > 100 && size.height > 100 {
                state.width = size.width;
                state.height = size.height;
            }
        }
    } else {
        // Se estiver maximizada, preserva o tamanho normal anterior se houver
        if let Some(prev) = WindowState::load(cache_dir) {
            state.x = prev.x;
            state.y = prev.y;
            state.width = prev.width;
            state.height = prev.height;
        }
    }

    let _ = state.save(cache_dir);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cache_dir = resolve_cache_dir();
    let app_config = AppConfig::load(&cache_dir);

    // Inicia o micro-proxy local
    let proxy = ProxyServer::start(cache_dir.clone(), app_config)
        .expect("Não foi possível iniciar o micro-proxy local");
    let proxy_port = proxy.port;

    tauri::Builder::default()
        .manage(AppState {
            cache_dir: cache_dir.clone(),
        })
        .invoke_handler(tauri::generate_handler![toggle_fullscreen])
        .setup(move |app| {
            if let Some(main_window) = app.get_webview_window("main") {
                // Restaura o estado salvo da janela
                if let Some(state) = WindowState::load(&cache_dir) {
                    if let (Some(x), Some(y)) = (state.x, state.y) {
                        let _ = main_window.set_position(Position::Physical(PhysicalPosition { x, y }));
                    }
                    if state.width > 200 && state.height > 200 {
                        let _ = main_window.set_size(Size::Physical(PhysicalSize {
                            width: state.width,
                            height: state.height,
                        }));
                    }
                    if state.maximized {
                        let _ = main_window.maximize();
                    }
                }

                // Injeta script para atalho F11 alternar tela cheia imersiva
                let f11_script = r#"
                    window.addEventListener('keydown', (e) => {
                        if (e.key === 'F11') {
                            e.preventDefault();
                            if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
                                window.__TAURI_INTERNALS__.invoke('toggle_fullscreen');
                            }
                        }
                    });
                "#;
                let _ = main_window.eval(f11_script);

                // Navega para o micro-proxy local
                let proxy_url = format!("http://127.0.0.1:{}/", proxy_port);
                if let Ok(parsed_url) = proxy_url.parse() {
                    let _ = main_window.navigate(parsed_url);
                }

                // Salva estado da janela ao fechar
                let win_clone = main_window.clone();
                let cache_clone = cache_dir.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event {
                        save_window_state(&win_clone, &cache_clone);
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
