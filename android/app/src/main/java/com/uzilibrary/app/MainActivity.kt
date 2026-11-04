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
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private val PREFS_NAME = "uzi_library_prefs"
    private val KEY_SERVER_URL = "server_url"
    private val DEFAULT_URL = "http://andreusd-fedora.local:8000"

    private var activeUrl: String? = null
    private var isPromptShowing = false
    private var lastNetworkError: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableImmersiveMode()

        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0a0a0a"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        setupWebView(rootLayout)
        setupProgressBar(rootLayout)
        setContentView(rootLayout)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    showExitOrConfigDialog()
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
        enableImmersiveMode()
        updateCacheMode()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveMode()
        }
    }

    private fun enableImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val attrib = window.attributes
            attrib.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = attrib
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun updateCacheMode() {
        val isOnline = isNetworkAvailable()
        val cacheMode = if (isOnline) {
            WebSettings.LOAD_DEFAULT
        } else {
            WebSettings.LOAD_CACHE_ELSE_NETWORK
        }
        webView.settings.cacheMode = cacheMode
    }

    private fun loadUrl(url: String) {
        activeUrl = url
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_SERVER_URL, url).apply()

        updateCacheMode()
        progressBar.visibility = View.VISIBLE
        webView.loadUrl(url)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(root: FrameLayout) {
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#0a0a0a"))
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

        updateCacheMode()

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

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                lastNetworkError = null
                Log.d("UziLibrary", "onPageFinished: $url")
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    val failingUrl = request.url.toString()
                    val errDesc = error?.description?.toString() ?: "Erro desconhecido"
                    val errCode = error?.errorCode ?: 0
                    Log.e("UziLibrary", "onReceivedError: url=$failingUrl, code=$errCode, desc=$errDesc, mode=${webView.settings.cacheMode}")

                    // If network failed while in LOAD_DEFAULT, immediately try loading from cache
                    if (webView.settings.cacheMode != WebSettings.LOAD_CACHE_ONLY) {
                        lastNetworkError = "$errDesc (código $errCode)"
                        runOnUiThread {
                            webView.settings.cacheMode = WebSettings.LOAD_CACHE_ONLY
                            webView.loadUrl(failingUrl)
                        }
                    } else {
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
            setHint("http://192.168.0.x:8000")
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
                    loadUrl(formatted)
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
                webView.settings.cacheMode = WebSettings.LOAD_CACHE_ONLY
                webView.loadUrl(saved)
            }
        }

        builder.show()
    }
}
