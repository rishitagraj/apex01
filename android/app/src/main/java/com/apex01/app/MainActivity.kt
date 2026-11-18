package com.apex01.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.MimeTypeMap
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.apex01.app.databinding.ActivityMainBinding
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermissionRequest: PermissionRequest? = null
    private var pendingPermissionResources: Array<String>? = null
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var lastBackPressTime = 0L
    private var mainFrameError = false
    private var pendingDownloadUrl: String? = null
    private var pendingDownloadUserAgent: String? = null
    private var pendingDownloadContentDisposition: String? = null
    private var pendingDownloadMimeType: String? = null

    private val allowedHosts: Set<String> by lazy {
        BuildConfig.ALLOWED_HOSTS.split(",")
            .map { it.trim().lowercase(Locale.ROOT) }
            .filter { it.isNotEmpty() }
            .toSet()
    }

    // Additional hosts allowed for in-WebView navigation to keep auth flows working (no URL UI shown).
    // Google OAuth behavior is preserved by allowing necessary auth redirects; adjust if your flow changes.
    private val authNavigationHosts = setOf(
        "accounts.google.com",
        "oauth2.googleapis.com",
        "www.googleapis.com",
        "apis.google.com",
        "ssl.gstatic.com",
        "www.gstatic.com",
        "lh3.googleusercontent.com",
    )

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback ?: return@registerForActivityResult
        filePathCallback = null
        val uris = if (result.resultCode == RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
                ?: result.data?.data?.let { arrayOf(it) }
        } else null
        callback.onReceiveValue(uris)
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val request = pendingPermissionRequest
        val resources = pendingPermissionResources
        pendingPermissionRequest = null
        pendingPermissionResources = null
        if (request != null && resources != null) {
            val granted = mutableListOf<String>()
            if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
                grants[Manifest.permission.CAMERA] == true
            ) granted.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
            if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                grants[Manifest.permission.RECORD_AUDIO] == true
            ) granted.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
            if (granted.isNotEmpty()) request.grant(granted.toTypedArray()) else request.deny()
        } else if (grants.values.any { !it }) {
            Toast.makeText(this, R.string.permission_denied, Toast.LENGTH_SHORT).show()
        }
    }

    private val downloadPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val url = pendingDownloadUrl
        if (granted && url != null) {
            enqueueDownload(
                url,
                pendingDownloadUserAgent,
                pendingDownloadContentDisposition,
                pendingDownloadMimeType
            )
        } else if (!granted) {
            Toast.makeText(this, R.string.download_failed, Toast.LENGTH_SHORT).show()
        }
        clearPendingDownload()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Disable WebView debugging in release builds (security requirement).
        if (!BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(false)
        }

        setupWebView()
        setupSwipeRefresh()
        setupBackHandling()

        binding.retryButton.setOnClickListener {
            hideError()
            loadMainUrl()
        }

        if (savedInstanceState != null) {
            binding.webView.restoreState(savedInstanceState)
        } else {
            loadMainUrl()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.webView.saveState(outState)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webView = binding.webView
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            allowFileAccess = true
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            cacheMode = WebSettings.LOAD_DEFAULT
            // Do not expose unnecessary native JavaScript interfaces.
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return handleUrl(request.url, request.isForMainFrame)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleUrl(Uri.parse(url), true)
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                if (isMainAppUrl(url)) {
                    mainFrameError = false
                    hideError()
                }
                binding.progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                binding.progressBar.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
                if (!mainFrameError && isMainAppUrl(url)) hideError()
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    mainFrameError = true
                    showError(getString(R.string.error_message))
                }
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: android.webkit.WebResourceResponse
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request.isForMainFrame && errorResponse.statusCode >= 500) {
                    mainFrameError = true
                    showError(getString(R.string.error_message))
                }
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
                // Never bypass HTTPS/certificate validation.
                handler.cancel()
                mainFrameError = true
                showError(getString(R.string.ssl_error))
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                binding.progressBar.progress = newProgress
                binding.progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                return try {
                    val intent = fileChooserParams.createIntent()
                    fileChooserLauncher.launch(intent)
                    true
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                val requested = request.resources
                val wantsCamera = requested.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                val wantsAudio = requested.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                if (!wantsCamera && !wantsAudio) {
                    request.deny()
                    return
                }
                if (!isTrustedOrigin(request.origin?.toString())) {
                    request.deny()
                    return
                }
                val needed = mutableListOf<String>()
                if (wantsCamera && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.CAMERA)
                }
                if (wantsAudio && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.RECORD_AUDIO)
                }
                if (needed.isEmpty()) {
                    val grant = mutableListOf<String>()
                    if (wantsCamera) grant.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                    if (wantsAudio) grant.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    request.grant(grant.toTypedArray())
                } else {
                    pendingPermissionRequest = request
                    pendingPermissionResources = requested
                    permissionLauncher.launch(needed.toTypedArray())
                }
            }

            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (customView != null) {
                    callback.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                binding.fullscreenContainer.visibility = View.VISIBLE
                binding.fullscreenContainer.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                binding.webView.visibility = View.GONE
                binding.swipeRefresh.visibility = View.GONE
                setFullscreen(true)
            }

            override fun onHideCustomView() {
                val view = customView ?: return
                binding.fullscreenContainer.removeView(view)
                binding.fullscreenContainer.visibility = View.GONE
                customView = null
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
                binding.webView.visibility = View.VISIBLE
                binding.swipeRefresh.visibility = View.VISIBLE
                setFullscreen(false)
            }

            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message
            ): Boolean {
                val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
                val temp = WebView(this@MainActivity)
                temp.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        handleUrl(request.url, true)
                        return true
                    }
                }
                transport.webView = temp
                resultMsg.sendToTarget()
                return true
            }
        }

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            handleDownload(url, userAgent, contentDisposition, mimeType)
        })
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeResources(R.color.apex_orange)
        binding.swipeRefresh.setOnChildScrollUpCallback { _, _ -> binding.webView.scrollY > 0 }
        binding.swipeRefresh.setOnRefreshListener {
            if (isOnline()) {
                hideError()
                binding.webView.reload()
            } else {
                binding.swipeRefresh.isRefreshing = false
                showError(getString(R.string.error_message))
            }
        }
    }

    private fun setupBackHandling() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    binding.webView.webChromeClient?.onHideCustomView()
                    return
                }
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    val now = System.currentTimeMillis()
                    if (now - lastBackPressTime < 2000) {
                        finish()
                    } else {
                        lastBackPressTime = now
                        Toast.makeText(this@MainActivity, "Press back again to exit", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun loadMainUrl() {
        if (!isOnline()) {
            showError(getString(R.string.error_message))
            return
        }
        hideError()
        binding.webView.loadUrl(BuildConfig.MAIN_URL)
    }

    private fun handleUrl(uri: Uri, isMainFrame: Boolean): Boolean {
        val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: return true
        if (scheme == "mailto" || scheme == "tel" || scheme == "intent") {
            try {
                val intent = if (scheme == "intent") Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                else Intent(Intent.ACTION_VIEW, uri)
                startActivity(intent)
            } catch (_: Exception) {
                Toast.makeText(this, R.string.download_failed, Toast.LENGTH_SHORT).show()
            }
            return true
        }
        if (scheme != "https") {
            // HTTPS-only navigation in the app.
            return true
        }
        val host = uri.host?.lowercase(Locale.ROOT) ?: return true
        if (isAllowedInWebView(host)) {
            // Internal/allowlisted: load inside WebView (no URL shown).
            return false
        }
        // External: open outside the app UI (Custom Tabs shows browser UI; this is outside our app's chrome).
        if (isMainFrame) openExternal(uri)
        return true
    }

    private fun isAllowedInWebView(host: String): Boolean {
        if (host in allowedHosts) return true
        if (host in authNavigationHosts) return true
        // Allow subdomains for configured hosts (e.g., supabase) and Google auth assets.
        return allowedHosts.any { host == it || host.endsWith(".$it") } ||
            host.endsWith(".supabase.co") ||
            host.endsWith(".google.com") ||
            host.endsWith(".googleapis.com") ||
            host.endsWith(".gstatic.com")
    }

    private fun isTrustedOrigin(origin: String?): Boolean {
        if (origin == null) return false
        return try {
            val host = Uri.parse(origin).host?.lowercase(Locale.ROOT) ?: return false
            isAllowedInWebView(host)
        } catch (_: Exception) { false }
    }

    private fun isMainAppUrl(url: String?): Boolean {
        if (url == null) return false
        return try {
            val host = Uri.parse(url).host?.lowercase(Locale.ROOT) ?: return false
            host == "apex01.vercel.app" || host.endsWith(".apex01.vercel.app")
        } catch (_: Exception) { false }
    }

    private fun openExternal(uri: Uri) {
        try {
            val intent = CustomTabsIntent.Builder().setShowTitle(false).build().intent
            intent.data = uri
            startActivity(intent)
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            } catch (_: ActivityNotFoundException) {}
        }
    }

    private fun handleDownload(url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingDownloadUrl = url
            pendingDownloadUserAgent = userAgent
            pendingDownloadContentDisposition = contentDisposition
            pendingDownloadMimeType = mimeType
            downloadPermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            return
        }
        enqueueDownload(url, userAgent, contentDisposition, mimeType)
    }

    private fun enqueueDownload(url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        try {
            val request = DownloadManager.Request(Uri.parse(url))
            val cookies = CookieManager.getInstance().getCookie(url)
            val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
            request.addRequestHeader("User-Agent", userAgent ?: binding.webView.settings.userAgentString)
            if (!cookies.isNullOrBlank()) request.addRequestHeader("Cookie", cookies)
            request.setMimeType(mimeType)
            request.setTitle(fileName)
            request.setDescription(getString(R.string.app_name))
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            request.allowScanningByMediaScanner()
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, R.string.download_started, Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, R.string.download_failed, Toast.LENGTH_SHORT).show()
            // Fallback: try opening in external browser/handler (e.g., some PDF links)
            try { openExternal(Uri.parse(url)) } catch (_: Exception) {}
        }
    }

    private fun clearPendingDownload() {
        pendingDownloadUrl = null
        pendingDownloadUserAgent = null
        pendingDownloadContentDisposition = null
        pendingDownloadMimeType = null
    }

    private fun showError(message: String) {
        binding.errorMessage.text = message
        binding.errorView.visibility = View.VISIBLE
    }

    private fun hideError() {
        binding.errorView.visibility = View.GONE
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun setFullscreen(fullscreen: Boolean) {
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        if (fullscreen) {
            windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
            windowInsetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            windowInsetsController.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
    }

    override fun onPause() {
        binding.webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        binding.webView.apply {
            stopLoading()
            loadUrl("about:blank")
            webChromeClient = null
            destroy()
        }
        super.onDestroy()
    }
}
