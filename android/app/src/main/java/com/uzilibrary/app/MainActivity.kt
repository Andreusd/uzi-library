package com.uzilibrary.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
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
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private val PREFS_NAME = "uzi_library_prefs"
    private val KEY_SERVER_URL = "server_url"
    private val DEFAULT_URL = "http://andreusd-fedora.local:8000"

    private var activeUrl: String? = null
    private var isPromptShowing = false

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
                    finish()
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
            loadAndVerifyUrl(savedUrl)
        }
    }

    override fun onResume() {
        super.onResume()
        enableImmersiveMode()
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
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mediaPlaybackRequiresUserGesture = false

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
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    val failingUrl = request.url.toString()
                    runOnUiThread {
                        promptServerUrl(
                            title = "Falha na Conexão",
                            message = "Não foi possível conectar ao servidor em:\n$failingUrl\n\nVerifique se o computador/servidor está ligado ou informe o novo endereço:",
                            prefill = failingUrl
                        )
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

        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
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
                    loadAndVerifyUrl(formatted)
                } else {
                    promptServerUrl(title, message, prefill)
                }
            }
            .show()
    }

    private fun loadAndVerifyUrl(url: String) {
        activeUrl = url
        progressBar.visibility = View.VISIBLE
        progressBar.isIndeterminate = true

        thread {
            var reachable = false
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 4000
                conn.readTimeout = 4000
                conn.requestMethod = "GET"
                conn.instanceFollowRedirects = true
                val code = conn.responseCode
                reachable = (code in 200..399)
                conn.disconnect()
            } catch (e: Exception) {
                reachable = false
            }

            runOnUiThread {
                progressBar.isIndeterminate = false
                if (reachable) {
                    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    prefs.edit().putString(KEY_SERVER_URL, url).apply()
                    webView.loadUrl(url)
                } else {
                    promptServerUrl(
                        title = "Servidor Inacessível",
                        message = "Não foi possível obter resposta de:\n$url\n\nVerifique se o serviço está rodando ou digite o endereço correto:",
                        prefill = url
                    )
                }
            }
        }
    }
}
