mod config;
mod proxy;

use std::sync::{Arc, Mutex};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cache_dir = resolve_cache_dir();
    let app_config = AppConfig::load(&cache_dir);

    // Inicia o micro-proxy local na porta padrão persistente (38482)
    let proxy = ProxyServer::start(cache_dir.clone(), app_config)
        .expect("Não foi possível iniciar o micro-proxy local");
    let proxy_port = proxy.port;

    let saved_state = WindowState::load(&cache_dir).unwrap_or_default();
    let state_lock = Arc::new(Mutex::new(saved_state));

    let state_for_setup = Arc::clone(&state_lock);
    let cache_dir_setup = cache_dir.clone();

    tauri::Builder::default()
        .manage(AppState {
            cache_dir: cache_dir.clone(),
        })
        .invoke_handler(tauri::generate_handler![toggle_fullscreen])
        .setup(move |app| {
            if let Some(main_window) = app.get_webview_window("main") {
                let initial_state = {
                    let s = state_for_setup.lock().unwrap();
                    s.clone()
                };

                // Restaura o tamanho e posição salvos antes de tornar a janela visível
                if let (Some(x), Some(y)) = (initial_state.x, initial_state.y) {
                    let _ = main_window.set_position(Position::Physical(PhysicalPosition { x, y }));
                }
                if initial_state.width > 200 && initial_state.height > 200 {
                    let _ = main_window.set_size(Size::Physical(PhysicalSize {
                        width: initial_state.width,
                        height: initial_state.height,
                    }));
                }
                if initial_state.maximized {
                    let _ = main_window.maximize();
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

                // Navega para o micro-proxy local na porta fixa
                let proxy_url = format!("http://127.0.0.1:{}/", proxy_port);
                if let Ok(parsed_url) = proxy_url.parse() {
                    let _ = main_window.navigate(parsed_url);
                }

                // Exibe a janela já posicionada e com foco
                let _ = main_window.show();
                let _ = main_window.set_focus();

                // Escuta eventos de movimentação e redimensionamento para salvar continuamente
                let win_clone = main_window.clone();
                let state_clone = Arc::clone(&state_for_setup);
                let cache_clone = cache_dir_setup.clone();

                main_window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Resized(new_size) => {
                            let is_max = win_clone.is_maximized().unwrap_or(false);
                            let mut s = state_clone.lock().unwrap();
                            s.maximized = is_max;
                            if !is_max && new_size.width > 200 && new_size.height > 200 {
                                s.width = new_size.width;
                                s.height = new_size.height;
                            }
                            let _ = s.save(&cache_clone);
                        }
                        tauri::WindowEvent::Moved(new_pos) => {
                            let is_max = win_clone.is_maximized().unwrap_or(false);
                            if !is_max {
                                let mut s = state_clone.lock().unwrap();
                                s.x = Some(new_pos.x);
                                s.y = Some(new_pos.y);
                                let _ = s.save(&cache_clone);
                            }
                        }
                        tauri::WindowEvent::CloseRequested { .. } => {
                            let is_max = win_clone.is_maximized().unwrap_or(false);
                            let mut s = state_clone.lock().unwrap();
                            s.maximized = is_max;
                            if !is_max {
                                if let Ok(pos) = win_clone.outer_position() {
                                    s.x = Some(pos.x);
                                    s.y = Some(pos.y);
                                }
                                if let Ok(size) = win_clone.inner_size() {
                                    if size.width > 200 && size.height > 200 {
                                        s.width = size.width;
                                        s.height = size.height;
                                    }
                                }
                            }
                            let _ = s.save(&cache_clone);
                        }
                        _ => {}
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
