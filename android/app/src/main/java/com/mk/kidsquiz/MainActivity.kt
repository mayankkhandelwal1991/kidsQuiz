package com.mk.kidsquiz

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.mk.kidsquiz.ui.theme.KidsQuizTheme
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.Locale

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    private var interstitialAd: InterstitialAd? = null
    private var rewardedAd: RewardedAd? = null
    private var rewardedInterstitialAd:
            RewardedInterstitialAd? = null

    // ==================================================
    // GOOGLE SIGN-IN (optional — kids can always "Continue as Guest")
    // ==================================================
    // Firebase "Web client ID" (OAuth client type 3 in google-services.json).
    // The ID token is handed to the web page, which signs in to Firebase with it.
    // Only the basic Google profile is requested: name + email (no extra scopes).
    private val WEB_CLIENT_ID =
        "851797718600-rn0qdbngmlq66gmvu624fll5eh34l9qi.apps.googleusercontent.com"

    private val credentialManager by lazy { CredentialManager.create(this) }
    private var signInInProgress = false

    // Text-to-speech for read-aloud in quizzes/games (WebView has no speechSynthesis).
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    // ==================================================
    // true = TEST ADS
    // false = LIVE ADS
    // ==================================================
    private val isTesting = false

    // ==================================================
    // TEST IDS
    // ==================================================
    private val testBannerAdId =
        "ca-app-pub-3940256099942544/6300978111"

    private val testInterstitialAdId =
        "ca-app-pub-3940256099942544/1033173712"

    private val testRewardedAdId =
        "ca-app-pub-3940256099942544/5224354917"

    private val testRewardedInterstitialAdId =
        "ca-app-pub-3940256099942544/5354046379"

    // ==================================================
    // LIVE IDS
    // ==================================================
    private val liveBannerAdId =
        "ca-app-pub-6850862418034067/6717045644"

    private val liveInterstitialAdId =
        "ca-app-pub-6850862418034067/4090882304"

    private val liveRewardedInterstitialAdId =
        "ca-app-pub-6850862418034067/5493947947"

    private val liveRewardedAdId =
        "ca-app-pub-6850862418034067/6535036644"

    // ==================================================
    // FINAL IDS
    // ==================================================
    private val bannerAdId
        get() =
            if (isTesting)
                testBannerAdId
            else
                liveBannerAdId

    private val interstitialAdId
        get() =
            if (isTesting)
                testInterstitialAdId
            else
                liveInterstitialAdId

    private val rewardedAdId
        get() =
            if (isTesting)
                testRewardedAdId
            else
                liveRewardedAdId

    private val rewardedInterstitialAdId
        get() =
            if (isTesting)
                testRewardedInterstitialAdId
            else
                liveRewardedInterstitialAdId

    // ==================================================
    // NETWORK CHECK  (ADDED)
    // ==================================================
    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        MobileAds.initialize(this)
        val requestConfiguration = RequestConfiguration.Builder()
            .setTagForChildDirectedTreatment(
                RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
            )
            .build()

        MobileAds.setRequestConfiguration(requestConfiguration)

        // Read-aloud voice for the web pages (Android.speak)
        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) tts?.language = Locale.US
        }

        loadInterstitialAd()
        loadRewardedAd()
        loadRewardedInterstitialAd()

        enableEdgeToEdge()

        // ==================================================
        // BACK BUTTON -> WEBVIEW HISTORY OR QUIT CONFIRMATION
        // ==================================================
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (::webView.isInitialized && webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        showExitDialog()
                    }
                }
            }
        )

        setContent {

            KidsQuizTheme {

                // ==================================================
                // NO-INTERNET STATE + LIVE CONNECTIVITY WATCH  (ADDED)
                // ==================================================
                var isConnected by remember { mutableStateOf(isNetworkAvailable()) }
                var reloadTrigger by remember { mutableStateOf(0) }

                DisposableEffect(Unit) {
                    val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                    val callback = object : ConnectivityManager.NetworkCallback() {
                        override fun onAvailable(network: Network) {
                            isConnected = true
                        }
                        override fun onLost(network: Network) {
                            isConnected = isNetworkAvailable()
                        }
                    }
                    cm.registerNetworkCallback(NetworkRequest.Builder().build(), callback)
                    onDispose { cm.unregisterNetworkCallback(callback) }
                }

                Scaffold(
                    modifier = Modifier.fillMaxSize()
                ) { innerPadding ->

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {

                        // WEBVIEW AREA (or no-internet screen)
                        Box(
                            modifier =
                                Modifier.weight(1f)
                        ) {

                            if (isConnected) {
                                key(reloadTrigger) {
                                    WebViewScreen(
                                        modifier =
                                            Modifier.fillMaxSize()
                                    )
                                }
                            } else {
                                NoInternetScreen(
                                    onRetry = {
                                        if (isNetworkAvailable()) {
                                            isConnected = true
                                            reloadTrigger++
                                        }
                                    }
                                )
                            }
                        }

                        // FIXED BOTTOM BANNER
                        BannerAd()
                    }
                }
            }
        }
    }

    // ==================================================
    // NO INTERNET SCREEN  (ADDED)
    // ==================================================
    @Composable
    fun NoInternetScreen(onRetry: () -> Unit) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF5F5F5)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(text = "📡", fontSize = 56.sp)
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "No Internet Connection",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Please check your connection and try again.",
                    fontSize = 14.sp,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(20.dp))
                Button(onClick = onRetry) {
                    Text("Retry")
                }
            }
        }
    }

    // ==================================================
    // START GOOGLE SIGN-IN
    // Shows the "Sign in with Google" account chooser. On success the ID
    // token goes to the page (window.onGoogleIdToken) which signs in to
    // Firebase; the player's Google name is then used on the leaderboard.
    // Cancel / failure just leaves the child on the screen, where
    // "Continue as Guest" still works — sign-in is never required.
    // ==================================================
    private fun startGoogleSignIn() {
        if (signInInProgress) return
        signInInProgress = true

        val option = GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID).build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()

        lifecycleScope.launch {
            try {
                val credential = credentialManager.getCredential(this@MainActivity, request).credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    val google = GoogleIdTokenCredential.createFrom(credential.data)
                    sendToPage(
                        "window.onGoogleIdToken && window.onGoogleIdToken(" +
                                JSONObject.quote(google.idToken) + ")"
                    )
                } else {
                    onSignInFailed("unexpected credential type")
                }
            } catch (e: GetCredentialCancellationException) {
                sendToPage("window.onGoogleSignInCancelled && window.onGoogleSignInCancelled()")
            } catch (e: GetCredentialException) {
                onSignInFailed(e.type + ": " + e.message)
            } catch (e: GoogleIdTokenParsingException) {
                onSignInFailed("token parse: " + e.message)
            } finally {
                signInInProgress = false
            }
        }
    }

    private fun onSignInFailed(reason: String) {
        Log.w("KidsQuizLogin", "Google sign-in failed: $reason")
        Toast.makeText(
            this,
            "Google sign-in didn't work. You can play as Guest.",
            Toast.LENGTH_LONG
        ).show()
        sendToPage("window.onGoogleSignInCancelled && window.onGoogleSignInCancelled()")
    }

    private fun signOutGoogle() {
        lifecycleScope.launch {
            try {
                credentialManager.clearCredentialState(ClearCredentialStateRequest())
            } catch (e: Exception) {
                Log.w("KidsQuizLogin", "clearCredentialState failed", e)
            }
        }
    }

    private fun sendToPage(js: String) {
        if (!::webView.isInitialized) return
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }

    // ==================================================
    // READ ALOUD (Android.speak)
    // ==================================================
    private fun speakText(text: String?, lang: String?) {
        if (!ttsReady || text.isNullOrBlank()) return
        val locale = when (lang?.lowercase()?.take(2)) {
            "hi" -> Locale("hi", "IN")
            else -> Locale.US
        }
        tts?.language = locale
        tts?.setSpeechRate(0.9f)
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "kq")
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }

    // ==================================================
    // SHARE APP
    // ==================================================
    private fun shareApp(
        subject: String = "Kids Quiz",
        message: String? = null
    ) {

        val appPackageName = packageName

        val playStoreLink =
            "https://play.google.com/store/apps/details?id=$appPackageName"

        val instagramLink =
            "https://www.instagram.com/kidsgames_quiz?igsh=dHVkdWVtNnFleXV1"

        val previewLink =
            "https://mayankkhandelwal1991.github.io/kidsQuiz/share-preview.png"

        val defaultMessage =
            "🧠✨ Turn screen time into fun learning!\n\n" +
                    "🎮 Kids Quiz — Play, Learn & Grow\n" +
                    "Fun quizzes and mini-games made for curious kids.\n\n" +
                    "▶️ Get it on Google Play:\n$playStoreLink\n\n" +
                    "📸 Follow us on Instagram for fun updates:\n$instagramLink\n\n" +
                    "🖼️ App preview:\n$previewLink"

        val shareIntent =
            Intent(Intent.ACTION_SEND).apply {

                type = "text/plain"

                putExtra(
                    Intent.EXTRA_SUBJECT,
                    subject
                )

                putExtra(
                    Intent.EXTRA_TEXT,
                    message?.takeIf { it.isNotBlank() } ?: defaultMessage
                )
            }

        try {
            startActivity(
                Intent.createChooser(
                    shareIntent,
                    "Share via"
                )
            )
        } catch (e: ActivityNotFoundException) {
            // No app available to handle the share intent
        }
    }

    // ==================================================
    // RATE APP ON GOOGLE PLAY
    // ==================================================
    private fun rateApp() {

        val appPackageName = packageName

        try {
            startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=$appPackageName")
                ).apply {
                    setPackage("com.android.vending")
                }
            )
        } catch (e: ActivityNotFoundException) {

            // Play Store app not installed, fall back to browser
            startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(
                        "https://play.google.com/store/apps/details?id=$appPackageName"
                    )
                )
            )
        }
    }

    private fun showRatingPrompt() {
        AlertDialog.Builder(this)
            .setTitle("Enjoying Kids Quiz?")
            .setMessage("Your rating helps us create more fun learning games for kids!")
            .setPositiveButton("Rate on Google Play") { _, _ -> rateApp() }
            .setNegativeButton("Not now", null)
            .show()
    }

    // ==================================================
    // OPEN EXTERNAL URL  (ADDED)
    // Generic bridge used by Instagram, More Games, and any
    // other external link the web page wants to open.
    // ==================================================
    private fun openUrl(url: String?) {
        if (url.isNullOrBlank()) return

        // Instagram links get special handling so they open straight into the
        // Instagram app with no "choose an app" popup. Everything else just
        // opens normally (browser, or whatever app claims that link type).
        if (url.contains("instagram.com")) {
            openInstagramLink(url)
            return
        }

        try {
            startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (e: ActivityNotFoundException) {
            // No app (browser) available to handle this URL — ignore
        }
    }

    // ==================================================
    // OPEN INSTAGRAM (APP-FIRST, NO CHOOSER POPUP)  (ADDED)
    // Targets the Instagram app explicitly via setPackage(), which
    // skips the system disambiguation dialog entirely. If Instagram
    // isn't installed, startActivity() throws ActivityNotFoundException
    // and we silently fall back to opening the same URL in the browser
    // — no popup either way, just one destination or the other.
    // ==================================================
    private fun openInstagramLink(url: String) {
        val username = Uri.parse(url).pathSegments.firstOrNull()

        if (!username.isNullOrBlank()) {
            val appIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("http://instagram.com/_u/$username")
            ).apply {
                setPackage("com.instagram.android")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            try {
                startActivity(appIntent)
                return
            } catch (e: ActivityNotFoundException) {
                // Instagram app not installed — send to its Play Store listing
                openInstagramOnPlayStore()
                return
            }
        }

        // Could not parse a username — just try the profile URL directly.
        try {
            startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (e: ActivityNotFoundException) {
            // No browser available either — nothing we can do
        }
    }

    // ==================================================
    // OPEN INSTAGRAM ON PLAY STORE  (ADDED)
    // Called when the Instagram app isn't installed. Tries the
    // Play Store app first (market://), falls back to the Play
    // Store web page if the Play Store app itself is unavailable.
    // ==================================================
    private fun openInstagramOnPlayStore() {
        try {
            startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=com.instagram.android")
                ).apply {
                    setPackage("com.android.vending")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (e: ActivityNotFoundException) {
            try {
                startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=com.instagram.android")
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            } catch (e2: ActivityNotFoundException) {
                // Nothing can handle it — give up silently
            }
        }
    }

    // ==================================================
    // EXIT CONFIRMATION DIALOG
    // ==================================================
    private fun showExitDialog() {

        AlertDialog.Builder(this)
            .setTitle("Quit App")
            .setMessage("Are you sure you want to close the app?")
            .setCancelable(true)
            .setPositiveButton("Yes") { dialog, _ ->
                dialog.dismiss()
                finish()
            }
            .setNegativeButton("No") { dialog, _ ->
                dialog.dismiss()
                // do nothing, just close the dialog
            }
            .show()
    }

    // ==================================================
    // WEBVIEW
    // ==================================================
    @SuppressLint("SetJavaScriptEnabled")
    @Composable
    fun WebViewScreen(
        modifier: Modifier = Modifier
    ) {

        AndroidView(
            modifier = modifier,

            factory = { context ->

                webView = WebView(context).apply {

                    layoutParams =
                        android.view.ViewGroup.LayoutParams(
                            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                            android.view.ViewGroup.LayoutParams.MATCH_PARENT
                        )

                    webViewClient =
                        object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView,
                                request: android.webkit.WebResourceRequest
                            ): Boolean {
                                val url = request.url.toString()

                                // "intent://" links (used by Instagram and many other
                                // sites to deep-link into their app) can't be loaded
                                // as a normal page — translate them into a real
                                // Android Intent instead of letting the WebView try
                                // and fail with ERR_UNKNOWN_URL_SCHEME.
                                if (url.startsWith("intent://")) {
                                    try {
                                        val intent = Intent.parseUri(
                                            url,
                                            Intent.URI_INTENT_SCHEME
                                        )
                                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        startActivity(intent)
                                    } catch (e: Exception) {
                                        // No app can handle it — stay put, ignore
                                    }
                                    return true
                                }

                                // Any other non-http(s) scheme (market:, tel:,
                                // mailto:, whatsapp:, upi:, etc.) — hand it to the
                                // system instead of letting the WebView load it.
                                if (!url.startsWith("http://") &&
                                    !url.startsWith("https://")
                                ) {
                                    try {
                                        startActivity(
                                            Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                            }
                                        )
                                    } catch (e: ActivityNotFoundException) {
                                        // No app installed to handle it — ignore
                                    }
                                    return true
                                }

                                // Normal http/https — let the WebView load it as usual.
                                return false
                            }
                        }

                    webChromeClient =
                        WebChromeClient()

                    settings.apply {

                        javaScriptEnabled =
                            true

                        domStorageEnabled =
                            true

                        databaseEnabled =
                            true

                        javaScriptCanOpenWindowsAutomatically =
                            true

                        loadWithOverviewMode =
                            true

                        useWideViewPort =
                            true

                        setSupportZoom(false)

                        builtInZoomControls =
                            false

                        displayZoomControls =
                            false

                        allowFileAccess =
                            true

                        allowContentAccess =
                            true

                        mixedContentMode =
                            WebSettings.MIXED_CONTENT_NEVER_ALLOW

                        mediaPlaybackRequiresUserGesture =
                            false

                        cacheMode =
                            WebSettings.LOAD_DEFAULT
                    }

                    // ======================
                    // SCROLL FIX
                    // ======================
                    isVerticalScrollBarEnabled =
                        true

                    isHorizontalScrollBarEnabled =
                        false

                    overScrollMode =
                        WebView.OVER_SCROLL_ALWAYS

                    scrollBarStyle =
                        WebView.SCROLLBARS_OUTSIDE_OVERLAY

                    isFocusable = true
                    isFocusableInTouchMode =
                        true

                    // MAIN FIX
                    setOnTouchListener { v, _ ->

                        v.parent
                            .requestDisallowInterceptTouchEvent(
                                true
                            )

                        false
                    }

                    setLayerType(
                        WebView.LAYER_TYPE_HARDWARE,
                        null
                    )

                    // JS Interface
                    addJavascriptInterface(
                        WebAppInterface(),
                        "Android"
                    )

                    loadUrl(
                        "https://mayankkhandelwal1991.github.io/kidsQuiz/quiz2.html"
                    )
                }

                webView
            }
        )
    }

    // ==================================================
    // BANNER
    // ==================================================
    @Composable
    fun BannerAd() {

        AndroidView(
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),

            factory = { context ->

                AdView(context).apply {

                    setAdSize(
                        AdSize.BANNER
                    )

                    adUnitId =
                        bannerAdId

                    loadAd(
                        AdRequest.Builder()
                            .build()
                    )
                }
            }
        )
    }

    // ==================================================
    // JS INTERFACE
    // ==================================================
    inner class WebAppInterface {

        @JavascriptInterface
        fun showAd(type: String) {

            runOnUiThread {

                when (
                    type.lowercase().trim()
                ) {

                    "interstitial" ->
                        showInterstitialAd()

                    "reward" ->
                        showRewardedAd()

                    "reward_interstitial" ->
                        showRewardedInterstitialAd()

                    else ->
                        webView.evaluateJavascript(
                            "onAdClosed('$type')",
                            null
                        )
                }
            }
        }

        // ==================================================
        // GOOGLE SIGN-IN  (ADDED)
        // The page calls Android.googleSignIn() (via KQ.signIn)
        // when the user taps "Sign in with Google".
        // Usage in JS:  Android.googleSignIn();
        // ==================================================
        @JavascriptInterface
        fun googleSignIn() {
            runOnUiThread {
                startGoogleSignIn()
            }
        }

        // Clears the remembered Google account (so the chooser shows
        // again next time). Called from the page's Sign out button.
        // Usage in JS:  Android.googleSignOut();
        @JavascriptInterface
        fun googleSignOut() {
            runOnUiThread { signOutGoogle() }
        }

        // The web page only shows "Sign in with Google" inside the app when
        // this returns true (older app builds had a broken sign-in bridge).
        // Usage in JS:  Android.isGoogleSignInReady();
        @JavascriptInterface
        fun isGoogleSignInReady(): Boolean = true

        // Read text aloud with the device voice.
        // Usage in JS:  Android.speak("Well done!", "en");
        @JavascriptInterface
        fun speak(text: String?, lang: String?) {
            runOnUiThread { speakText(text, lang) }
        }

        // ==================================================
        // Call this from your web JS to show the
        // "close app?" confirmation popup on demand.
        // Usage in JS:  Android.showExitConfirmation();
        // ==================================================
        @JavascriptInterface
        fun showExitConfirmation() {
            runOnUiThread {
                showExitDialog()
            }
        }

        // ==================================================
        // Call this from your web JS to open the native
        // share sheet for this app.
        // Usage in JS: Android.shareAppContent(title, message);
        // The no-argument method remains for older pages.
        // ==================================================
        @JavascriptInterface
        fun shareApp() {
            runOnUiThread {
                this@MainActivity.shareApp()
            }
        }

        @JavascriptInterface
        fun shareAppContent(title: String?, message: String?) {
            runOnUiThread {
                this@MainActivity.shareApp(
                    subject = title?.takeIf { it.isNotBlank() } ?: "Kids Quiz",
                    message = message
                )
            }
        }

        // ==================================================
        // Call this from your web JS to open this app's
        // Google Play listing so the user can rate it.
        // Usage in JS:  Android.rateApp();
        // ==================================================
        @JavascriptInterface
        fun rateApp() {
            runOnUiThread {
                this@MainActivity.rateApp()
            }
        }

        @JavascriptInterface
        fun showRatingPrompt() {
            runOnUiThread {
                this@MainActivity.showRatingPrompt()
            }
        }

        // ==================================================
        // OPEN EXTERNAL URL  (ADDED)
        // Generic bridge for Instagram, More Games, or any
        // other external link. Opens in the default browser
        // (or a matching installed app, e.g. Instagram) via
        // a standard ACTION_VIEW intent.
        // Usage in JS:  Android.openUrl("https://...");
        // ==================================================
        @JavascriptInterface
        fun openUrl(url: String?) {
            runOnUiThread {
                this@MainActivity.openUrl(url)
            }
        }

        // Convenience wrapper matching quiz-shared.js's moreGames().
        // Usage in JS:  Android.moreGames();
        @JavascriptInterface
        fun moreGames() {
            runOnUiThread {
                this@MainActivity.openUrl(
                    "https://play.google.com/store/apps/developer?id=Mayank+Logic"
                )
            }
        }
    }

    // ==================================================
    // INTERSTITIAL
    // ==================================================
    private fun loadInterstitialAd() {

        InterstitialAd.load(
            this,
            interstitialAdId,
            AdRequest.Builder().build(),

            object :
                InterstitialAdLoadCallback() {

                override fun onAdLoaded(
                    ad: InterstitialAd
                ) {
                    interstitialAd = ad
                }

                override fun
                        onAdFailedToLoad(
                    error: LoadAdError
                ) {
                    interstitialAd = null
                }
            }
        )
    }

    private fun showInterstitialAd() {

        if (interstitialAd == null) {
            loadInterstitialAd()
            return
        }

        interstitialAd
            ?.fullScreenContentCallback =
            object :
                FullScreenContentCallback() {

                override fun
                        onAdDismissedFullScreenContent() {

                    interstitialAd =
                        null

                    loadInterstitialAd()

                    webView
                        .evaluateJavascript(
                            "onAdClosed('interstitial')",
                            null
                        )
                }
            }

        interstitialAd?.show(this)
    }

    // ==================================================
    // REWARDED
    // ==================================================
    private fun loadRewardedAd() {

        RewardedAd.load(
            this,
            rewardedAdId,
            AdRequest.Builder().build(),

            object :
                RewardedAdLoadCallback() {

                override fun onAdLoaded(
                    ad: RewardedAd
                ) {
                    rewardedAd = ad
                }

                override fun
                        onAdFailedToLoad(
                    error: LoadAdError
                ) {
                    rewardedAd = null
                }
            }
        )
    }

    private fun showRewardedAd() {

        if (rewardedAd == null) {
            loadRewardedAd()
            return
        }

        rewardedAd
            ?.fullScreenContentCallback =
            object :
                FullScreenContentCallback() {

                override fun
                        onAdDismissedFullScreenContent() {

                    rewardedAd =
                        null

                    loadRewardedAd()

                    webView
                        .evaluateJavascript(
                            "onAdClosed('reward')",
                            null
                        )
                }
            }

        rewardedAd?.show(this) {

            webView
                .evaluateJavascript(
                    "onRewardEarned('${it.type}','${it.amount}')",
                    null
                )
        }
    }

    // ==================================================
    // REWARDED INTERSTITIAL
    // ==================================================
    private fun loadRewardedInterstitialAd() {

        RewardedInterstitialAd.load(
            this,
            rewardedInterstitialAdId,
            AdRequest.Builder().build(),

            object :
                RewardedInterstitialAdLoadCallback() {

                override fun onAdLoaded(
                    ad:
                    RewardedInterstitialAd
                ) {
                    rewardedInterstitialAd =
                        ad
                }

                override fun
                        onAdFailedToLoad(
                    error: LoadAdError
                ) {
                    rewardedInterstitialAd =
                        null
                }
            }
        )
    }

    private fun
            showRewardedInterstitialAd() {

        if (
            rewardedInterstitialAd
            == null
        ) {
            loadRewardedInterstitialAd()
            return
        }

        rewardedInterstitialAd
            ?.fullScreenContentCallback =
            object :
                FullScreenContentCallback() {

                override fun
                        onAdDismissedFullScreenContent() {

                    rewardedInterstitialAd =
                        null

                    loadRewardedInterstitialAd()

                    webView
                        .evaluateJavascript(
                            "onAdClosed('reward_interstitial')",
                            null
                        )
                }
            }

        rewardedInterstitialAd
            ?.show(this) {

                webView
                    .evaluateJavascript(
                        "onRewardEarned('${it.type}','${it.amount}')",
                        null
                    )
            }
    }
}