package com.vaidyaashwani.livecalltranslator

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Vaidya Ashwani Live Call Translator.
 * App ka poora design web/ folder (HTML/CSS/JS) me hai, jo APK ke andar assets me aata hai
 * aur https://appassets.androidplatform.net/assets/index.html par khulta hai (secure origin,
 * isliye camera/mic/WebRTC kaam karte hain). Bolna/sunna/file save native Android se hota hai
 * (NativeBridge -> window.AndroidBridge).
 */
class MainActivity : AppCompatActivity() {

    lateinit var webView: WebView
        private set
    private lateinit var bridge: NativeBridge
    private var pendingWebPermission: PermissionRequest? = null

    private val permLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
            val req = pendingWebPermission ?: return@registerForActivityResult
            pendingWebPermission = null
            grantWebPermission(req)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#063D27"))
        webView = WebView(this)
        webView.setBackgroundColor(Color.parseColor("#063D27"))
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)

        // Status bar / navigation bar ke peeche content na jaaye
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            textZoom = 100
        }
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        bridge = NativeBridge(this)
        webView.addJavascriptInterface(bridge, "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == "appassets.androidplatform.net") return false
                openExternal(url.toString())   // privacy policy ke links, WhatsApp, tel: wagairah
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { handleWebPermission(request) }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("(window.appBack ? window.appBack() : 'exit')") { result ->
                    if (result == null || result.contains("exit")) {
                        moveTaskToBack(true)   // app background me chalta rahe, taaki call aa sake
                    }
                }
            }
        })

        if (savedInstanceState == null) {
            webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    // Note: webView.onPause() jaan-boojh kar call nahi karte, taaki app background me hone par
    // bhi incoming call ki ring aa sake (jab tak Android app ko band na kare).

    override fun onDestroy() {
        bridge.shutdown()
        webView.destroy()
        super.onDestroy()
    }

    /* ---------------- Camera / Mic permission for WebRTC ---------------- */

    private fun androidPermsFor(req: PermissionRequest): Array<String> {
        val list = mutableListOf<String>()
        if (req.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) list += Manifest.permission.RECORD_AUDIO
        if (req.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) list += Manifest.permission.CAMERA
        return list.toTypedArray()
    }

    private fun handleWebPermission(req: PermissionRequest) {
        val missing = androidPermsFor(req).filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            grantWebPermission(req)
        } else {
            pendingWebPermission?.deny()
            pendingWebPermission = req
            permLauncher.launch(missing.toTypedArray())
        }
    }

    private fun grantWebPermission(req: PermissionRequest) {
        val granted = req.resources.filter { res ->
            when (res) {
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> hasPerm(Manifest.permission.RECORD_AUDIO)
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> hasPerm(Manifest.permission.CAMERA)
                else -> false
            }
        }
        if (granted.isEmpty()) req.deny() else req.grant(granted.toTypedArray())
    }

    fun hasPerm(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    fun requestBasicPermissions() {
        val all = mutableListOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
        if (android.os.Build.VERSION.SDK_INT >= 33) all += Manifest.permission.POST_NOTIFICATIONS
        val need = all.filter { !hasPerm(it) }
        if (need.isNotEmpty()) permLauncher.launch(need.toTypedArray())
    }

    /* ---------------- Helpers used by NativeBridge ---------------- */

    fun keepScreenOn(on: Boolean) {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    fun openExternal(url: String) {
        try {
            val uri = Uri.parse(url)
            val intent = if (uri.scheme == "tel") Intent(Intent.ACTION_DIAL, uri) else Intent(Intent.ACTION_VIEW, uri)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            callJs("window.toast && toast('Ye app phone me nahi mila')")
        }
    }

    /** JS callback: function name + arguments (JSON-escaped). */
    fun callJs(fn: String, vararg args: Any?) {
        val js = if (args.isEmpty()) fn else {
            val a = args.joinToString(",") { arg ->
                when (arg) {
                    null -> "null"
                    is Number, is Boolean -> arg.toString()
                    else -> JSONObject.quote(arg.toString())
                }
            }
            "$fn($a)"
        }
        runOnUiThread { if (!isDestroyed) webView.evaluateJavascript(js, null) }
    }
}
