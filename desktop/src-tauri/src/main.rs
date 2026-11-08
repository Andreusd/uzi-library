// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    {
        // Força aceleração de GPU completa, rasterização por hardware e zero-copy no WebView2
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --enable-features=VaapiVideoDecoder,CanvasOopRasterization",
        );
    }

    uzi_library_desktop_lib::run();
}
