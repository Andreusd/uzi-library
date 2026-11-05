package com.uzilibrary.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var rootLayout: FrameLayout
    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private val PREFS_NAME = "uzi_library_prefs"
    private val KEY_SERVER_URL = "server_url"
    private val DEFAULT_URL = "http://andreusd-fedora.local:8000"

    private var activeUrl: String? = null
    private var isPromptShowing = false
    private var lastNetworkError: String? = null
    private var isFullscreen = false
    private var lastInsets: Insets? = null
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0a0a0a"))
            overScrollMode = View.OVER_SCROLL_NEVER
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            lastInsets = insets
            if (isFullscreen) {
                view.setPadding(0, 0, 0, 0)
            } else {
                view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            }
            windowInsets
        }

        setupWebView(rootLayout)
        setupProgressBar(rootLayout)
        setContentView(rootLayout)

        applyFullscreenState()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    webView.webChromeClient?.onHideCustomView()
                    return
                }

                // Check if web application can handle the back navigation (modals, drawers, reader, shelf navigation)
                webView.evaluateJavascript("(function(){ return Boolean(window.__uziHandleBack && window.__uziHandleBack()); })();") { result ->
                    val handled = result?.trim()?.equals("true", ignoreCase = true) == true
                    if (!handled) {
                        runOnUiThread {
                            if (isFullscreen) {
                                setFullscreenMode(false)
                            } else if (webView.canGoBack()) {
                                webView.goBack()
                            } else {
                                showExitOrConfigDialog()
                            }
                        }
                    }
                }
            }
        })

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_SERVER_URL, null)

        if (savedUrl.isNullOrBlank()) {
            promptServerUrl(
                title = "Configurar Uzi Library",
                message = "Digite a URL do seu servidor Uzi Library na rede local ou internet:",
                prefill = DEFAULT_URL
            )
        } else {
            loadUrl(savedUrl)
        }
    }

    override fun onResume() {
        super.onResume()
        applyFullscreenState()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applyFullscreenState()
        }
    }

    fun setFullscreenMode(enabled: Boolean) {
        if (isFullscreen == enabled) return
        isFullscreen = enabled
        applyFullscreenState()
        val script = "window.dispatchEvent(new CustomEvent('uzi-fullscreen-change', { detail: { isFullscreen: $enabled } }));"
        webView.evaluateJavascript(script, null)
    }

    private fun applyFullscreenState() {
        val window = window
        val controller = WindowInsetsControllerCompat(window, window.decorView)

        if (isFullscreen) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val attrib = window.attributes
                attrib.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                window.attributes = attrib
            }
            WindowCompat.setDecorFitsSystemWindows(window, false)
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            rootLayout.setPadding(0, 0, 0, 0)
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val attrib = window.attributes
                attrib.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT
                window.attributes = attrib
            }
            WindowCompat.setDecorFitsSystemWindows(window, false)
            controller.show(WindowInsetsCompat.Type.systemBars())
            controller.isAppearanceLightStatusBars = false
            controller.isAppearanceLightNavigationBars = false
            window.statusBarColor = Color.parseColor("#0a0a0a")
            window.navigationBarColor = Color.parseColor("#0a0a0a")

            lastInsets?.let { insets ->
                rootLayout.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            }
        }

        ViewCompat.requestApplyInsets(rootLayout)
    }

    private fun isNetworkConnected(): Boolean {
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return true
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        } catch (e: Exception) {
            true
        }
    }

    private fun resolveMdnsHost(hostname: String, timeoutMs: Int = 1500): String? {
        if (!hostname.endsWith(".local", ignoreCase = true)) return null
        return try {
            val socket = java.net.DatagramSocket()
            socket.soTimeout = timeoutMs

            val buffer = java.io.ByteArrayOutputStream()
            // DNS Header: ID=0, Flags=0, Questions=1, Answer=0, Auth=0, Add=0
            buffer.write(byteArrayOf(0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0))
            for (part in hostname.split(".")) {
                if (part.isNotEmpty()) {
                    val bytes = part.toByteArray()
                    buffer.write(bytes.size)
                    buffer.write(bytes)
                }
            }
            buffer.write(0) // end of domain
            buffer.write(byteArrayOf(0, 1, 0, 1)) // Type A, Class IN

            val packet = java.net.DatagramPacket(
                buffer.toByteArray(),
                buffer.size(),
                java.net.InetAddress.getByName("224.0.0.251"),
                5353
            )
            socket.send(packet)

            val recvBuf = ByteArray(1024)
            val recvPacket = java.net.DatagramPacket(recvBuf, recvBuf.size)
            val startTime = System.currentTimeMillis()
            while (System.currentTimeMillis() - startTime < timeoutMs) {
                socket.receive(recvPacket)
                val senderIp = recvPacket.address.hostAddress
                if (!senderIp.isNullOrBlank() && senderIp != "127.0.0.1") {
                    socket.close()
                    Log.d("UziLibrary", "mDNS resolved $hostname -> $senderIp")
                    return senderIp
                }
            }
            socket.close()
            null
        } catch (e: Exception) {
            Log.w("UziLibrary", "mDNS resolve exception for $hostname: ${e.message}")
            null
        }
    }

    private fun loadUrl(rawUrl: String, forceCache: Boolean = false) {
        activeUrl = rawUrl
        lastNetworkError = null
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_SERVER_URL, rawUrl).apply()

        val cacheMode = if (forceCache || !isNetworkConnected()) {
            WebSettings.LOAD_CACHE_ELSE_NETWORK
        } else {
            WebSettings.LOAD_DEFAULT
        }
        webView.settings.cacheMode = cacheMode
        progressBar.visibility = View.VISIBLE

        val uri = try { java.net.URI(rawUrl) } catch (e: Exception) { null }
        val host = uri?.host

        if (!forceCache && host != null && host.endsWith(".local", ignoreCase = true)) {
            kotlin.concurrent.thread {
                val resolvedIp = resolveMdnsHost(host)
                val finalUrl = if (resolvedIp != null) {
                    val portPart = if (uri.port != -1) ":${uri.port}" else ""
                    val pathPart = uri.rawPath ?: ""
                    "${uri.scheme ?: "http"}://$resolvedIp$portPart$pathPart"
                } else {
                    rawUrl
                }
                runOnUiThread {
                    Log.d("UziLibrary", "loadUrl: finalUrl=$finalUrl (raw=$rawUrl) cacheMode=$cacheMode")
                    webView.loadUrl(finalUrl)
                }
            }
        } else {
            Log.d("UziLibrary", "loadUrl: $rawUrl with cacheMode=$cacheMode")
            webView.loadUrl(rawUrl)
        }
    }

    private fun recordError(category: String, message: String) {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val timestamp = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date())
            val entry = "[$timestamp][$category] $message"
            prefs.edit().putString("last_native_error", entry).apply()

            val existing = prefs.getString("all_error_logs", "") ?: ""
            val updated = if (existing.isEmpty()) entry else "$entry\n---\n$existing".take(10000)
            prefs.edit().putString("all_error_logs", updated).apply()
        } catch (e: Exception) {
            Log.e("UziLibrary", "recordError failed: ${e.message}")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(root: FrameLayout) {
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#0a0a0a"))
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            visibility = View.VISIBLE
        }

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                val swController = ServiceWorkerController.getInstance()
                swController.setServiceWorkerClient(object : ServiceWorkerClient() {
                    override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
                        return null
                    }
                })
            } catch (e: Exception) {
                // Ignore if service worker unsupported
            }
        }

        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun toggleFullscreen() {
                runOnUiThread {
                    setFullscreenMode(!isFullscreen)
                }
            }

            @JavascriptInterface
            fun setFullscreen(enabled: Boolean) {
                runOnUiThread {
                    setFullscreenMode(enabled)
                }
            }

            @JavascriptInterface
            fun isFullscreen(): Boolean {
                return isFullscreen
            }

            @JavascriptInterface
            fun reportError(errorJson: String) {
                Log.e("UziLibraryFrontend", "Frontend reported error: $errorJson")
                recordError("FRONTEND_CRASH", errorJson)
            }

            @JavascriptInterface
            fun getErrorLogs(): String {
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                return prefs.getString("all_error_logs", "") ?: ""
            }

            @JavascriptInterface
            fun clearErrorLogs() {
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().remove("last_native_error").remove("all_error_logs").apply()
            }
        }, "AndroidApp")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    onHideCustomView()
                    return
                }
                customView = view
                customViewCallback = callback
                if (view != null) {
                    view.setBackgroundColor(Color.parseColor("#0a0a0a"))
                    rootLayout.addView(
                        view,
                        FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                    webView.visibility = View.GONE
                }
                runOnUiThread {
                    setFullscreenMode(true)
                }
            }

            override fun onHideCustomView() {
                val cv = customView
                if (cv != null) {
                    rootLayout.removeView(cv)
                    customView = null
                    webView.visibility = View.VISIBLE
                    customViewCallback?.onCustomViewHidden()
                    customViewCallback = null
                }
                runOnUiThread {
                    setFullscreenMode(false)
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                val level = consoleMessage.messageLevel()
                val msg = consoleMessage.message()
                val source = "${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}"
                if (level == ConsoleMessage.MessageLevel.ERROR) {
                    Log.e("UziLibraryJS", "[$level] $msg ($source)")
                    recordError("JS_CONSOLE_ERROR", "$msg ($source)")
                }
                return super.onConsoleMessage(consoleMessage)
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                lastNetworkError = null
                Log.d("UziLibrary", "onPageFinished: $url")
            }

            override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                val didCrash = detail?.didCrash() ?: false
                val msg = "WebView render process gone! didCrash=$didCrash"
                Log.e("UziLibrary", msg)
                recordError("RENDER_PROCESS_GONE", msg)
                runOnUiThread {
                    try {
                        rootLayout.removeView(webView)
                        webView.destroy()
                        setupWebView(rootLayout)
                        activeUrl?.let { loadUrl(it) }
                    } catch (e: Exception) {
                        Log.e("UziLibrary", "Failed to recreate WebView: ${e.message}")
                    }
                }
                return true
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    val failingUrl = request.url.toString()
                    val errDesc = error?.description?.toString() ?: "Erro de conexão"
                    val errCode = error?.errorCode ?: 0
                    Log.e("UziLibrary", "onReceivedError: url=$failingUrl, code=$errCode, desc=$errDesc, currentMode=${webView.settings.cacheMode}")

                    // If network failed while in LOAD_DEFAULT, attempt fallback to cache once
                    if (webView.settings.cacheMode == WebSettings.LOAD_DEFAULT) {
                        lastNetworkError = "$errDesc (código $errCode)"
                        runOnUiThread {
                            // Use LOAD_CACHE_ELSE_NETWORK (never LOAD_CACHE_ONLY which causes ERR_CACHE_MISS)
                            webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                            webView.loadUrl(failingUrl)
                        }
                    } else {
                        // If cache fallback also failed, show dialog with the real original error
                        val diag = lastNetworkError ?: "$errDesc (código $errCode)"
                        runOnUiThread {
                            promptServerUrl(
                                title = "Servidor Inacessível",
                                message = "Não foi possível conectar ao servidor em:\n$failingUrl\n\nDiagnóstico: $diag\n\nVerifique se o computador/servidor está ligado ou informe o novo endereço:",
                                prefill = failingUrl
                            )
                        }
                    }
                }
            }
        }

        root.addView(webView)
    }

    private fun setupProgressBar(root: FrameLayout) {
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                8
            )
            isIndeterminate = false
            max = 100
            visibility = View.GONE
        }
        root.addView(progressBar)
    }

    private fun showExitOrConfigDialog() {
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Uzi Library")
            .setMessage("O que você gostaria de fazer?")
            .setPositiveButton("Sair") { _, _ -> finish() }
            .setNeutralButton("Alterar Servidor") { _, _ ->
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val currentUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_URL) ?: DEFAULT_URL
                promptServerUrl(
                    title = "Configurar Servidor",
                    message = "Endereço atual do servidor:",
                    prefill = currentUrl
                )
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun promptServerUrl(title: String, message: String, prefill: String) {
        if (isPromptShowing || isFinishing) return
        isPromptShowing = true

        val input = EditText(this).apply {
            setText(prefill)
            setSelection(text.length)
            setSingleLine(true)
            setHint("http://andreusd-fedora.local:8000")
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
            setBackgroundColor(Color.parseColor("#1a1a1a"))
            setPadding(40, 30, 40, 30)
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 20, 50, 20)
            addView(input)
        }

        val builder = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle(title)
            .setMessage(message)
            .setView(container)
            .setCancelable(false)
            .setPositiveButton("Conectar") { dialog, _ ->
                isPromptShowing = false
                dialog.dismiss()
                val rawUrl = input.text.toString().trim()
                if (rawUrl.isNotEmpty()) {
                    var formatted = rawUrl
                    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
                        formatted = "http://$formatted"
                    }
                    while (formatted.endsWith("/")) {
                        formatted = formatted.substring(0, formatted.length - 1)
                    }
                    loadUrl(formatted, forceCache = false)
                } else {
                    promptServerUrl(title, message, prefill)
                }
            }

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_SERVER_URL, null)
        if (!saved.isNullOrBlank()) {
            builder.setNeutralButton("Modo Offline") { dialog, _ ->
                isPromptShowing = false
                dialog.dismiss()
                loadUrl(saved, forceCache = true)
            }
        }

        builder.show()
    }

    override fun onDestroy() {
        if (customView != null) {
            webView.webChromeClient?.onHideCustomView()
        }
        super.onDestroy()
    }
}
