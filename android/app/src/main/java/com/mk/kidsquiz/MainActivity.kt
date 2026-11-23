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
import androidx.credentials.CredentialOption
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.TextButton
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.OutlinedButton
import androidx.compose.ui.text.style.TextAlign
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
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
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

    // ==================================================
    // LOGIN SESSION (native login screen, shared with the web page)
    // mode: ""  -> show the native login screen
    //       "google" -> signed in with Google (token handed to the page)
    //       "guest"  -> playing as a guest
    // The page reads it with Android.getAuthSession() and signs in to
    // Firebase with the Google ID token, so app and web stay in sync.
    // ==================================================
    private val authPrefs by lazy { getSharedPreferences("kq_auth", Context.MODE_PRIVATE) }
    private var authMode by mutableStateOf("")
    private var loginBusy by mutableStateOf(false)
    private var loginError by mutableStateOf("")
    // Google ID tokens live ~1 hour; hand the page only a fresh one.
    private val TOKEN_FRESH_MS = 50 * 60 * 1000L

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

        // Who was signed in last time (Google / guest), or "" -> login screen.
        authMode = authPrefs.getString("mode", "") ?: ""

        // ==================================================
        // BACK BUTTON -> WEBVIEW HISTORY OR QUIT CONFIRMATION
        // ==================================================
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (authMode.isEmpty()) {
                        showExitDialog()
                    } else if (::webView.isInitialized && webView.canGoBack()) {
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

                            if (isConnected && authMode.isEmpty()) {
                                // Not signed in yet: native login screen first.
                                LoginScreen()
                            } else if (isConnected) {
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

                        // FIXED BOTTOM BANNER (not on the login screen)
                        if (authMode.isNotEmpty()) BannerAd()
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
    // GOOGLE SIGN-IN (native)
    // silent = false: the "Sign in with Google" account chooser (login screen,
    //                 or the page's own sign-in button).
    // silent = true:  quietly get a fresh ID token for the account already
    //                 chosen (the page asks when its saved token is too old);
    //                 falls back to the chooser if that isn't possible.
    // On success the profile + ID token are saved, and the page signs in to
    // Firebase with the token -> the same account on the app and the web.
    // ==================================================
    private fun startGoogleSignIn(silent: Boolean = false) {
        if (signInInProgress) return
        signInInProgress = true
        if (!silent) { loginBusy = true; loginError = "" }

        val option: CredentialOption = if (silent)
            GetGoogleIdOption.Builder()
                .setServerClientId(WEB_CLIENT_ID)
                .setFilterByAuthorizedAccounts(true)
                .setAutoSelectEnabled(true)
                .build()
        else
            GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID).build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()

        lifecycleScope.launch {
            var retryInteractive = false
            try {
                val credential = credentialManager.getCredential(this@MainActivity, request).credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    onGoogleSignedIn(GoogleIdTokenCredential.createFrom(credential.data))
                } else {
                    onSignInFailed("unexpected credential type")
                }
            } catch (e: GetCredentialCancellationException) {
                onSignInCancelled()
            } catch (e: NoCredentialException) {
                // Silent refresh found no remembered account -> show the chooser.
                if (silent) retryInteractive = true else onSignInFailed("no credential: " + e.message)
            } catch (e: GetCredentialException) {
                if (silent) retryInteractive = true else onSignInFailed(e.type + ": " + e.message)
            } catch (e: GoogleIdTokenParsingException) {
                onSignInFailed("token parse: " + e.message)
            } finally {
                signInInProgress = false
            }
            if (retryInteractive) startGoogleSignIn(silent = false)
        }
    }

    private fun onGoogleSignedIn(google: GoogleIdTokenCredential) {
        authPrefs.edit()
            .putString("mode", "google")
            .putString("name", google.displayName ?: "")
            .putString("email", google.id)
            .putString("photo", google.profilePictureUri?.toString() ?: "")
            .putString("idToken", google.idToken)
            .putLong("tokenAt", System.currentTimeMillis())
            .apply()
        loginBusy = false
        loginError = ""
        if (authMode.isEmpty()) {
            // From the login screen: open the app; the page picks the token
            // up from Android.getAuthSession() as soon as it loads.
            authMode = "google"
        } else {
            // The page is already open (token refresh, or a guest upgrading
            // to Google): hand it the token now.
            authMode = "google"
            sendToPage(
                "window.onGoogleIdToken && window.onGoogleIdToken(" +
                        JSONObject.quote(google.idToken) + ", true)"
            )
        }
    }

    private fun onSignInCancelled() {
        loginBusy = false
        if (authMode.isNotEmpty())
            sendToPage("window.onGoogleSignInCancelled && window.onGoogleSignInCancelled()")
    }

    private fun onSignInFailed(reason: String) {
        Log.w("KidsQuizLogin", "Google sign-in failed: $reason")
        loginBusy = false
        if (authMode.isEmpty()) {
            loginError = "Google sign-in didn't work. Check your internet and try again, or play as a guest."
        } else {
            Toast.makeText(this, "Google sign-in didn't work. Please try again.", Toast.LENGTH_LONG).show()
            sendToPage("window.onGoogleSignInCancelled && window.onGoogleSignInCancelled()")
        }
    }

    private fun continueAsGuest() {
        authPrefs.edit().clear().putString("mode", "guest").apply()
        loginError = ""
        authMode = "guest"
    }

    // Sign out (Google or guest): forget the saved login and go back to the
    // native login screen. A short delay lets the page finish its own
    // Firebase sign-out first.
    private fun signOutApp() {
        authPrefs.edit().clear().apply()
        lifecycleScope.launch {
            try {
                credentialManager.clearCredentialState(ClearCredentialStateRequest())
            } catch (e: Exception) {
                Log.w("KidsQuizLogin", "clearCredentialState failed", e)
            }
        }
        webViewHandler.postDelayed({ authMode = "" }, 700)
    }
    private val webViewHandler by lazy { android.os.Handler(mainLooper) }

    // Session for the page (Android.getAuthSession): JSON string.
    private fun authSessionJson(): String {
        val o = JSONObject()
        val mode = authPrefs.getString("mode", "") ?: ""
        o.put("mode", mode)
        o.put("name", authPrefs.getString("name", "") ?: "")
        o.put("email", authPrefs.getString("email", "") ?: "")
        o.put("photo", authPrefs.getString("photo", "") ?: "")
        val at = authPrefs.getLong("tokenAt", 0L)
        val fresh = mode == "google" && System.currentTimeMillis() - at < TOKEN_FRESH_MS
        o.put("idToken", if (fresh) authPrefs.getString("idToken", "") ?: "" else "")
        o.put("v", 1)
        return o.toString()
    }

    // ==================================================
    // NATIVE LOGIN SCREEN
    // ==================================================
    @Composable
    fun LoginScreen() {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF7DD3FC), Color(0xFFBAE6FD), Color(0xFFFDE68A))
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp)
                    .widthIn(max = 420.dp)
                    .fillMaxWidth()
                    .background(Color.White, RoundedCornerShape(28.dp))
                    .padding(horizontal = 22.dp, vertical = 28.dp)
            ) {
                // App logo ("Kids Game & Quiz")
                Image(
                    painter = painterResource(id = R.drawable.app_logo),
                    contentDescription = "Kids Game & Quiz",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(168.dp)
                        .shadow(10.dp, RoundedCornerShape(32.dp))
                        .clip(RoundedCornerShape(32.dp))
                )
                Spacer(modifier = Modifier.height(18.dp))
                Text(
                    text = "Sign in to save your stars, scores and progress on every device",
                    fontSize = 14.sp,
                    color = Color(0xFF6B7280),
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(22.dp))

                // Standard "Sign in with Google" button (Google branding:
                // white, grey outline, multicolour G, dark text).
                OutlinedButton(
                    onClick = { startGoogleSignIn() },
                    enabled = !loginBusy,
                    shape = RoundedCornerShape(50),
                    border = BorderStroke(1.dp, Color(0xFF747775)),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = Color.White,
                        contentColor = Color(0xFF1F1F1F),
                        disabledContainerColor = Color.White
                    ),
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    if (loginBusy) {
                        CircularProgressIndicator(
                            color = Color(0xFF4285F4),
                            strokeWidth = 3.dp,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Signing in…", fontSize = 16.sp, fontWeight = FontWeight.Medium, color = Color(0xFF1F1F1F))
                    } else {
                        Image(
                            painter = painterResource(id = R.drawable.ic_google_g),
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Sign in with Google", fontSize = 16.sp, fontWeight = FontWeight.Medium)
                    }
                }

                if (loginError.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = loginError,
                        fontSize = 13.sp,
                        color = Color(0xFFDC2626),
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))
                TextButton(onClick = { continueAsGuest() }, enabled = !loginBusy) {
                    Text(
                        "Play as Guest",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF4F46E5)
                    )
                }
                Text(
                    text = "We only use your name and email to show you on the leaderboard.",
                    fontSize = 11.sp,
                    color = Color(0xFF9CA3AF),
                    textAlign = TextAlign.Center
                )
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
    // Takes space only once an ad is actually showing; with no ad (no fill,
    // offline, error) the WebView uses the full height — no blank white strip.
    @Composable
    fun BannerAd() {

        var adShown by remember { mutableStateOf(false) }

        AndroidView(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (adShown) Modifier.wrapContentHeight() else Modifier.height(0.dp)),

            factory = { context ->

                AdView(context).apply {

                    setAdSize(
                        AdSize.BANNER
                    )

                    adUnitId =
                        bannerAdId

                    adListener = object : AdListener() {
                        override fun onAdLoaded() {
                            adShown = true
                        }

                        override fun onAdFailedToLoad(error: LoadAdError) {
                            // A failed refresh keeps the previous ad on screen;
                            // only collapse when nothing was ever shown.
                            Log.d("KidsQuizAds", "Banner not filled: ${error.code} ${error.message}")
                        }
                    }

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
            runOnUiThread { signOutApp() }
        }

        // The app's login (from the native login screen) for the page:
        // {"mode":"google"|"guest"|"","name","email","photo","idToken"}.
        // idToken is "" when it's too old -> call refreshGoogleToken().
        // Usage in JS:  JSON.parse(Android.getAuthSession())
        @JavascriptInterface
        fun getAuthSession(): String = authSessionJson()

        // Get a fresh Google ID token for the signed-in account; it comes
        // back through window.onGoogleIdToken(token, true).
        // Usage in JS:  Android.refreshGoogleToken();
        @JavascriptInterface
        fun refreshGoogleToken() {
            runOnUiThread { startGoogleSignIn(silent = true) }
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