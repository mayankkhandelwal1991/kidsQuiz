package com.mk.kidsquiz

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback
// --- Google Sign-In imports (ADDED) ---
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.mk.kidsquiz.ui.theme.KidsQuizTheme

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    private var interstitialAd: InterstitialAd? = null
    private var rewardedAd: RewardedAd? = null
    private var rewardedInterstitialAd:
            RewardedInterstitialAd? = null

    // ==================================================
    // GOOGLE SIGN-IN  (ADDED)
    // ==================================================
    // Paste your Firebase "Web client ID" here
    // (Firebase console -> Authentication -> Google ->
    //  Web SDK configuration -> Web client ID). It ends
    // with .apps.googleusercontent.com
    private val WEB_CLIENT_ID =
        "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"

    private lateinit var googleSignInClient: GoogleSignInClient

    // Receives the result of the Google account chooser and
    // forwards the ID token to the web page.
    private val signInLauncher =
        registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            try {
                val account = GoogleSignIn
                    .getSignedInAccountFromIntent(result.data)
                    .getResult(ApiException::class.java)

                val idToken = account?.idToken

                if (idToken != null && ::webView.isInitialized) {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onGoogleIdToken && " +
                                "window.onGoogleIdToken('$idToken')",
                            null
                        )
                    }
                }
            } catch (e: ApiException) {
                // 12501 = user cancelled the chooser; ignore.
                // Any other code -> check e.statusCode + SHA-1 / Web client ID.
            }
        }

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        MobileAds.initialize(this)

        // ==================================================
        // GOOGLE SIGN-IN CLIENT  (ADDED)
        // ==================================================
        val gso = GoogleSignInOptions
            .Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(WEB_CLIENT_ID)
            .requestEmail()
            .build()

        googleSignInClient = GoogleSignIn.getClient(this, gso)

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

                Scaffold(
                    modifier = Modifier.fillMaxSize()
                ) { innerPadding ->

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {

                        // WEBVIEW AREA
                        Box(
                            modifier =
                                Modifier.weight(1f)
                        ) {

                            WebViewScreen(
                                modifier =
                                    Modifier.fillMaxSize()
                            )
                        }

                        // FIXED BOTTOM BANNER
                        BannerAd()
                    }
                }
            }
        }
    }

    // ==================================================
    // START GOOGLE SIGN-IN  (ADDED)
    // Signs out first so the account chooser always shows.
    // ==================================================
    private fun startGoogleSignIn() {
        googleSignInClient.signOut().addOnCompleteListener {
            signInLauncher.launch(googleSignInClient.signInIntent)
        }
    }

    // ==================================================
    // SHARE APP
    // ==================================================
    private fun shareApp() {

        val appPackageName = packageName

        val playStoreLink =
            "https://play.google.com/store/apps/details?id=$appPackageName"

        val shareIntent =
            Intent(Intent.ACTION_SEND).apply {

                type = "text/plain"

                putExtra(
                    Intent.EXTRA_SUBJECT,
                    "Kids Quiz"
                )

                putExtra(
                    Intent.EXTRA_TEXT,
                    "Check out this fun Kids Quiz app!\n$playStoreLink"
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
                        WebViewClient()

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
                            WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

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

        // Clears the cached Google account (so the chooser shows
        // again next time). Called from the page's Sign out button.
        // Usage in JS:  Android.googleSignOut();
        @JavascriptInterface
        fun googleSignOut() {
            runOnUiThread {
                if (::googleSignInClient.isInitialized) {
                    googleSignInClient.signOut()
                }
            }
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
        // Usage in JS:  Android.shareApp();
        // ==================================================
        @JavascriptInterface
        fun shareApp() {
            runOnUiThread {
                this@MainActivity.shareApp()
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
