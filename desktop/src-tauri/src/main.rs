// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    {
        // Força aceleração de GPU completa e rasterização por hardware no WebView2
        // sem zero-copy nem Vaapi, que causam pipeline stalls no Windows com GPU híbrida (AMD + NVIDIA)
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--enable-gpu-rasterization --ignore-gpu-blocklist",
        );
    }

    uzi_library_desktop_lib::run();
}
