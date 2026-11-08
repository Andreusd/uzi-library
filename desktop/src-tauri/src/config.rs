use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

pub const DEFAULT_SERVER_URL: &str = "http://andreusd-fedora.local:8000";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub server_url: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server_url: DEFAULT_SERVER_URL.to_string(),
        }
    }
}

impl AppConfig {
    pub fn load(cache_dir: &Path) -> Self {
        let config_path = cache_dir.join("config.json");
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(mut cfg) = serde_json::from_str::<AppConfig>(&content) {
                cfg.server_url = normalize_url(&cfg.server_url);
                return cfg;
            }
        }
        let default_cfg = Self::default();
        let _ = default_cfg.save(cache_dir);
        default_cfg
    }

    pub fn save(&self, cache_dir: &Path) -> std::io::Result<()> {
        let config_path = cache_dir.join("config.json");
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        fs::write(config_path, json)
    }
}

pub fn normalize_url(raw: &str) -> String {
    let trimmed = raw.trim();
    let with_scheme = if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        format!("http://{}", trimmed)
    } else {
        trimmed.to_string()
    };
    with_scheme.trim_end_matches('/').to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowState {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: None,
            y: None,
            width: 1280,
            height: 800,
            maximized: false,
        }
    }
}

impl WindowState {
    pub fn load(cache_dir: &Path) -> Option<Self> {
        let path = cache_dir.join("window_state.json");
        if let Ok(content) = fs::read_to_string(path) {
            serde_json::from_str::<WindowState>(&content).ok()
        } else {
            None
        }
    }

    pub fn save(&self, cache_dir: &Path) -> std::io::Result<()> {
        let path = cache_dir.join("window_state.json");
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        fs::write(path, json)
    }
}

/// Determina o diretório de cache.
/// 1ª Opção: Pasta `cache` no mesmo diretório do .exe (Modo Pendrive / Portátil).
/// Fallback: `%LOCALAPPDATA%\UziLibrary\cache` ou diretório de dados do usuário caso o diretório do .exe seja somente leitura.
pub fn resolve_cache_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let portable_cache = exe_dir.join("cache");
            if fs::create_dir_all(&portable_cache).is_ok() {
                // Testa permissão de escrita
                let test_file = portable_cache.join(".write_test");
                if fs::write(&test_file, b"ok").is_ok() {
                    let _ = fs::remove_file(test_file);
                    let _ = fs::create_dir_all(portable_cache.join("web"));
                    return portable_cache;
                }
            }
        }
    }

    // Fallback para LOCALAPPDATA ou diretório temp
    let fallback = if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local_app_data).join("UziLibrary").join("cache")
    } else if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        PathBuf::from(home).join(".uzilibrary").join("cache")
    } else {
        std::env::temp_dir().join("UziLibrary").join("cache")
    };

    let _ = fs::create_dir_all(&fallback);
    let _ = fs::create_dir_all(fallback.join("web"));
    fallback
}
