use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tiny_http::{Header, Method, Response, Server, StatusCode};
use serde::{Deserialize, Serialize};

use crate::config::{AppConfig, normalize_url};

#[derive(Serialize, Deserialize)]
struct SetServerPayload {
    server_url: String,
}

#[derive(Serialize, Deserialize)]
struct ApiResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[allow(dead_code)]
pub struct ProxyServer {
    pub port: u16,
    pub cache_dir: PathBuf,
    pub config: Arc<RwLock<AppConfig>>,
}

impl ProxyServer {
    pub fn start(cache_dir: PathBuf, config: AppConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let server = Server::http("127.0.0.1:0").map_err(|e| format!("Falha ao iniciar servidor HTTP local: {}", e))?;
        let port = server.server_addr().to_ip().ok_or("Erro de endereço IP")?.port();
        let config_arc = Arc::new(RwLock::new(config));

        let server_thread_cache = cache_dir.clone();
        let server_thread_config = Arc::clone(&config_arc);

        std::thread::spawn(move || {
            let ureq_agent = ureq::AgentBuilder::new()
                .timeout_connect(Duration::from_millis(1800))
                .timeout_read(Duration::from_millis(6000))
                .build();

            for request in server.incoming_requests() {
                let cache_dir = server_thread_cache.clone();
                let config_lock = Arc::clone(&server_thread_config);
                let agent = ureq_agent.clone();

                std::thread::spawn(move || {
                    let url_str = request.url().to_string();
                    let method = request.method().clone();

                    // Rota de configuração interna
                    if url_str.starts_with("/__uzi_desktop__/") {
                        handle_internal_route(request, &url_str, &cache_dir, &config_lock, &agent);
                        return;
                    }

                    let server_url = {
                        let cfg = config_lock.read().unwrap();
                        cfg.server_url.clone()
                    };

                    match method {
                        Method::Get | Method::Head => {
                            handle_get_request(request, &url_str, &server_url, &cache_dir, &agent);
                        }
                        _ => {
                            // Forward POST/PUT/DELETE/etc para o servidor
                            handle_mutation_request(request, &url_str, &server_url, &agent);
                        }
                    }
                });
            }
        });

        Ok(Self {
            port,
            cache_dir,
            config: config_arc,
        })
    }
}

fn handle_internal_route(
    mut request: tiny_http::Request,
    url: &str,
    cache_dir: &Path,
    config_lock: &Arc<RwLock<AppConfig>>,
    agent: &ureq::Agent,
) {
    let clean_url = url.split('?').next().unwrap_or(url);
    if clean_url == "/__uzi_desktop__/set_server" {
        let mut body_str = String::new();
        let _ = request.as_reader().read_to_string(&mut body_str);

        if let Ok(payload) = serde_json::from_str::<SetServerPayload>(&body_str) {
            let target_url = normalize_url(&payload.server_url);

            // Testa conectividade com o novo servidor
            let test_target = format!("{}/", target_url);
            match agent.get(&test_target).timeout(Duration::from_millis(2500)).call() {
                Ok(_) => {
                    // Salva configuração
                    {
                        let mut cfg = config_lock.write().unwrap();
                        cfg.server_url = target_url;
                        let _ = cfg.save(cache_dir);
                    }
                    let resp = ApiResponse { ok: true, error: None };
                    let json = serde_json::to_string(&resp).unwrap();
                    let response = Response::from_string(json)
                        .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                        .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                    let _ = request.respond(response);
                    return;
                }
                Err(e) => {
                    let resp = ApiResponse {
                        ok: false,
                        error: Some(format!("Falha na conexão: {}", e)),
                    };
                    let json = serde_json::to_string(&resp).unwrap();
                    let response = Response::from_string(json)
                        .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                        .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                    let _ = request.respond(response);
                    return;
                }
            }
        }

        let resp = ApiResponse { ok: false, error: Some("Payload inválido".to_string()) };
        let response = Response::from_string(serde_json::to_string(&resp).unwrap())
            .with_status_code(StatusCode(400))
            .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
        let _ = request.respond(response);
    } else {
        let response = Response::from_string("{\"ok\":true}")
            .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
        let _ = request.respond(response);
    }
}

fn sanitize_path(url_path: &str) -> PathBuf {
    let raw_path = url_path.split('?').next().unwrap_or(url_path);
    let mut path = PathBuf::new();
    for seg in raw_path.split('/') {
        if seg.is_empty() || seg == "." || seg == ".." {
            continue;
        }
        path.push(seg);
    }
    path
}

fn is_page_route(rel_path: &Path) -> bool {
    let s = rel_path.to_string_lossy();
    if s.is_empty() || s == "index.html" {
        return true;
    }
    // Rotas de SPA como /books, /settings, /folder/123
    rel_path.extension().is_none()
}

fn attach_headers(mut req: ureq::Request, headers: &[tiny_http::Header]) -> ureq::Request {
    for h in headers {
        let name = h.field.as_str();
        let name_lower = name.to_ascii_lowercase();
        // Não repassar cabeçalhos de controle de transporte para evitar conflito com ureq
        if name_lower == "host" || name_lower == "content-length" || name_lower == "connection" {
            continue;
        }
        req = req.set(name, h.value.as_str());
    }
    req
}

fn should_cache_response(url_str: &str, status: u16) -> bool {
    if status != 200 {
        return false;
    }
    let path = url_str.split('?').next().unwrap_or(url_str);
    // Não cacheia chamadas de API como arquivos estáticos (são dinâmicas e contextuais por usuário)
    if path.starts_with("/api/") || path.starts_with("/__uzi") {
        return false;
    }
    // Cacheia index/páginas, assets, capas e recursos estáticos
    is_page_route(Path::new(path))
        || path.starts_with("/assets/")
        || path.starts_with("/covers/")
        || path.ends_with(".js")
        || path.ends_with(".css")
        || path.ends_with(".png")
        || path.ends_with(".jpg")
        || path.ends_with(".jpeg")
        || path.ends_with(".webp")
        || path.ends_with(".svg")
        || path.ends_with(".woff2")
        || path.ends_with(".woff")
        || path.ends_with(".ico")
}

fn handle_get_request(
    request: tiny_http::Request,
    url_str: &str,
    server_url: &str,
    cache_dir: &Path,
    agent: &ureq::Agent,
) {
    let rel_path = sanitize_path(url_str);
    let web_cache_dir = cache_dir.join("web");
    let upstream_url = format!("{}{}", server_url, url_str);

    let mut ureq_req = agent.get(&upstream_url);
    ureq_req = attach_headers(ureq_req, request.headers());

    // Tenta obter do upstream
    let upstream_result = ureq_req.call();

    match upstream_result {
        Ok(resp) => {
            let status = resp.status();
            let content_type = resp.header("content-type").unwrap_or("").to_string();

            let mut reader = resp.into_reader();
            let mut bytes = Vec::new();
            let _ = reader.read_to_end(&mut bytes);

            if should_cache_response(url_str, status) {
                // Salva no cache local em disco apenas assets estáticos e páginas
                let file_path = if is_page_route(&rel_path) {
                    web_cache_dir.join("index.html")
                } else {
                    web_cache_dir.join(&rel_path)
                };

                if let Some(parent) = file_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&file_path, &bytes);
            }

            let mut response = Response::from_data(bytes).with_status_code(StatusCode(status));
            if !content_type.is_empty() {
                if let Ok(h) = Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()) {
                    response.add_header(h);
                }
            }
            if let Ok(cors) = Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]) {
                response.add_header(cors);
            }
            let _ = request.respond(response);
        }
        Err(_) => {
            // Se for rota de API e o upstream falhar, retorna 503 com JSON offline
            let clean_path = url_str.split('?').next().unwrap_or(url_str);
            if clean_path.starts_with("/api/") {
                let json = r#"{"ok":false,"offline":true,"message":"Servidor offline"}"#;
                let response = Response::from_string(json)
                    .with_status_code(StatusCode(503))
                    .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                let _ = request.respond(response);
                return;
            }

            // Servidor upstream inacessível -> Recorre ao cache local para páginas e assets
            serve_from_cache_or_fallback(request, &rel_path, &web_cache_dir, server_url);
        }
    }
}

fn serve_from_cache_or_fallback(
    request: tiny_http::Request,
    rel_path: &Path,
    web_cache_dir: &Path,
    server_url: &str,
) {
    let index_file = web_cache_dir.join("index.html");

    if is_page_route(rel_path) {
        if index_file.exists() {
            if let Ok(bytes) = fs::read(&index_file) {
                let response = Response::from_data(bytes)
                    .with_status_code(StatusCode(200))
                    .with_header(Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"X-Uzi-Cache"[..], &b"HIT"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                let _ = request.respond(response);
                return;
            }
        }

        // Se index.html não existe no cache (primeiro acesso offline sem servidor):
        // Renderiza a tela de fallback dark amigável
        let fallback_html = render_fallback_screen(server_url);
        let response = Response::from_string(fallback_html)
            .with_status_code(StatusCode(200))
            .with_header(Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap())
            .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
        let _ = request.respond(response);
        return;
    }

    // Para outros recursos (assets, imagens, css, js)
    let asset_path = web_cache_dir.join(rel_path);
    if asset_path.exists() {
        if let Ok(bytes) = fs::read(&asset_path) {
            let mime = mime_guess::from_path(&asset_path).first_or_octet_stream();
            let response = Response::from_data(bytes)
                .with_status_code(StatusCode(200))
                .with_header(Header::from_bytes(&b"Content-Type"[..], mime.as_ref().as_bytes()).unwrap())
                .with_header(Header::from_bytes(&b"X-Uzi-Cache"[..], &b"HIT"[..]).unwrap())
                .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
            let _ = request.respond(response);
            return;
        }
    }

    // Não encontrado nem no servidor nem no cache
    let response = Response::from_string("404 Not Found")
        .with_status_code(StatusCode(404))
        .with_header(Header::from_bytes(&b"Content-Type"[..], &b"text/plain"[..]).unwrap());
    let _ = request.respond(response);
}

fn handle_mutation_request(
    mut request: tiny_http::Request,
    url_str: &str,
    server_url: &str,
    agent: &ureq::Agent,
) {
    let upstream_url = format!("{}{}", server_url, url_str);
    let mut body = Vec::new();
    let _ = request.as_reader().read_to_end(&mut body);

    let method_str = request.method().as_str();
    let mut ureq_req = match method_str {
        "POST" => agent.post(&upstream_url),
        "PUT" => agent.put(&upstream_url),
        "DELETE" => agent.delete(&upstream_url),
        _ => agent.request(method_str, &upstream_url),
    };

    ureq_req = attach_headers(ureq_req, request.headers());

    match ureq_req.send_bytes(&body) {
        Ok(resp) => {
            let status = resp.status();
            let content_type = resp.header("content-type").unwrap_or("").to_string();
            let mut reader = resp.into_reader();
            let mut resp_bytes = Vec::new();
            let _ = reader.read_to_end(&mut resp_bytes);

            let mut response = Response::from_data(resp_bytes).with_status_code(StatusCode(status));
            if !content_type.is_empty() {
                if let Ok(h) = Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()) {
                    response.add_header(h);
                }
            }
            if let Ok(cors) = Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]) {
                response.add_header(cors);
            }
            let _ = request.respond(response);
        }
        Err(_) => {
            let json = r#"{"ok":false,"offline":true,"message":"Servidor offline"}"#;
            let response = Response::from_string(json)
                .with_status_code(StatusCode(503))
                .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
            let _ = request.respond(response);
        }
    }
}

fn render_fallback_screen(current_url: &str) -> String {
    format!(r##"<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Uzi Library - Conexão</title>
  <style>
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    body {{
      background-color: #0a0a0a;
      color: #e5e5e5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }}
    .card {{
      background: #141414;
      border: 1px solid #262626;
      border-radius: 14px;
      padding: 36px 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      text-align: center;
    }}
    .logo-container {{
      width: 60px;
      height: 60px;
      background: #1f1f1f;
      border: 1px solid #333333;
      border-radius: 12px;
      margin: 0 auto 20px auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .logo-icon {{
      width: 32px;
      height: 32px;
      fill: #ffffff;
    }}
    h1 {{
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 12px;
      letter-spacing: -0.3px;
    }}
    p {{
      font-size: 14px;
      line-height: 1.55;
      color: #a3a3a3;
      margin-bottom: 24px;
    }}
    .input-group {{
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: left;
    }}
    label {{
      font-size: 12px;
      font-weight: 500;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    input[type="text"] {{
      width: 100%;
      background: #0a0a0a;
      border: 1px solid #333333;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 14px;
      color: #ffffff;
      outline: none;
      transition: border-color 0.2s;
    }}
    input[type="text"]:focus {{
      border-color: #6366f1;
    }}
    .btn {{
      width: 100%;
      background: #22c55e;
      color: #000000;
      border: none;
      border-radius: 8px;
      padding: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, opacity 0.2s;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }}
    .btn:hover {{
      background: #16a34a;
    }}
    .btn:disabled {{
      opacity: 0.6;
      cursor: not-allowed;
    }}
    .btn-secondary {{
      background: transparent;
      color: #888888;
      border: 1px solid #333333;
      margin-top: 8px;
    }}
    .btn-secondary:hover {{
      background: #1a1a1a;
      color: #ffffff;
    }}
    .status {{
      margin-top: 16px;
      font-size: 13px;
      min-height: 20px;
    }}
    .status.error {{
      color: #ef4444;
    }}
    .status.success {{
      color: #22c55e;
    }}
    .spinner {{
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0, 0, 0, 0.3);
      border-top-color: #000000;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }}
    @keyframes spin {{
      to {{ transform: rotate(360deg); }}
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <svg class="logo-icon" viewBox="0 0 24 24">
        <path d="M19 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H19C20.1046 22 21 21.1046 21 20V4C21 2.89543 20.1046 2 19 2ZM19 20H6V4H7V13L9.5 11.5L12 13V4H19V20Z"/>
      </svg>
    </div>
    <h1>Servidor não encontrado</h1>
    <p>Conecte-se à rede local para o primeiro carregamento ou informe o endereço do servidor:</p>

    <div class="input-group">
      <label for="serverUrl">Endereço do Servidor</label>
      <input type="text" id="serverUrl" value="{}" placeholder="http://andreusd-fedora.local:8000" />
      <button class="btn" id="connectBtn" onclick="testAndConnect()">
        <span id="btnText">Testar e Conectar</span>
      </button>
      <button class="btn btn-secondary" onclick="window.location.reload()">
        Tentar Novamente
      </button>
    </div>

    <div class="status" id="statusMsg"></div>
  </div>

  <script>
    async function testAndConnect() {{
      const input = document.getElementById('serverUrl');
      const btn = document.getElementById('connectBtn');
      const btnText = document.getElementById('btnText');
      const status = document.getElementById('statusMsg');

      const url = input.value.trim();
      if (!url) {{
        status.className = 'status error';
        status.textContent = 'Informe uma URL válida.';
        return;
      }}

      btn.disabled = true;
      btnText.innerHTML = '<span class="spinner"></span> Testando conexão...';
      status.className = 'status';
      status.textContent = '';

      try {{
        const response = await fetch('/__uzi_desktop__/set_server', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ server_url: url }})
        }});

        const result = await response.json();
        if (result.ok) {{
          status.className = 'status success';
          status.textContent = 'Conectado com sucesso! Carregando aplicativo...';
          setTimeout(() => {{
            window.location.href = '/';
          }}, 800);
        }} else {{
          status.className = 'status error';
          status.textContent = result.error || 'Não foi possível conectar ao servidor.';
          btn.disabled = false;
          btnText.textContent = 'Testar e Conectar';
        }}
      }} catch (err) {{
        status.className = 'status error';
        status.textContent = 'Erro ao se comunicar com o proxy interno: ' + err.message;
        btn.disabled = false;
        btnText.textContent = 'Testar e Conectar';
      }}
    }}

    document.getElementById('serverUrl').addEventListener('keydown', (e) => {{
      if (e.key === 'Enter') {{
        testAndConnect();
      }}
    }});
  </script>
</body>
</html>
"##, current_url)
}
