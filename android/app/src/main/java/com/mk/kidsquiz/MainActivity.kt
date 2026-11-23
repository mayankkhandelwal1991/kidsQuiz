package com.mk.kidsquiz

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
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
    @Volatile private var adNetworkStatus: String = "{}"   // JSON, filled when MobileAds has started

    // AdMob's ID for this phone (MD5 of ANDROID_ID) - the value setTestDeviceIds wants.
    // The advertising ID can't be used: its permission is removed (kids app).
    private val testDeviceId: String by lazy {
        try {
            val aid = android.provider.Settings.Secure.getString(contentResolver, android.provider.Settings.Secure.ANDROID_ID) ?: ""
            java.security.MessageDigest.getInstance("MD5").digest(aid.toByteArray())
                .joinToString("") { "%02X".format(it) }
        } catch (e: Exception) { "" }
    }

    // Kids-app ad rules (see above) + test devices from the admin console.
    // Called at start and again when fresh settings arrive.
    private fun applyAdRequestConfig(testIds: List<String>) {
        MobileAds.setRequestConfiguration(
            RequestConfiguration.Builder()
                .setTagForChildDirectedTreatment(RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE)
                .setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE)
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
                .setTestDeviceIds(testIds)
                .build()
        )
        if (testDeviceId in testIds) Log.i("KidsQuizAds", "This phone is an AdMob test device: test ads only")
    }
    // Last load result per ad type, for the admin console (Android.getAdLoadStatus).
    private val adLoadStatus = java.util.concurrent.ConcurrentHashMap<String, String>()
    private fun noteAd(kind: String, error: LoadAdError?) {
        val msg = if (error == null) "loaded" else {
            val src = error.responseInfo?.adapterResponses?.joinToString("; ") { r ->
                r.adapterClassName.substringAfterLast('.') + "=" + (r.adError?.let { "${it.code} ${it.message}" } ?: "ok")
            } ?: ""
            "error ${error.code}: ${error.message}" + (if (src.isNotEmpty()) " [$src]" else "")
        }
        adLoadStatus[kind] = System.currentTimeMillis().toString() + "|" + msg
        Log.d("KidsQuizAds", "$kind: $msg")
    }
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

    // ==================================================
    // APP SETTINGS FROM THE WEB ADMIN CONSOLE (see AppConfig.kt)
    // ==================================================
    private var offlineAllowed by mutableStateOf(false)   // play without internet?
    private var bannerOn by mutableStateOf(true)          // bottom AdMob banner
    private val notifPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) Reminders.schedule(this) }

    // ==================================================
    // MANDATORY UPDATE (Admin console -> App settings -> App update)
    // Only when the admin marks the update as mandatory AND this install is
    // older than the minimum version (or, with no minimum set, Play reports a
    // newer version). Otherwise nothing is shown.
    // Google Play's full-screen "IMMEDIATE" update first; if Play can't do it
    // (e.g. not installed from Play), a dialog that only leads to the Play Store.
    // ==================================================
    private val appUpdateManager by lazy { com.google.android.play.core.appupdate.AppUpdateManagerFactory.create(this) }
    private var updateDialog: AlertDialog? = null
    private val updateLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        // Mandatory: closing Google's update screen doesn't let them in.
        if (result.resultCode != RESULT_OK) checkMandatoryUpdate(AppConfig.load(this))
    }

    private fun installedVersionCode(): Long = try {
        val pi = packageManager.getPackageInfo(packageName, 0)
        if (Build.VERSION.SDK_INT >= 28) pi.longVersionCode else @Suppress("DEPRECATION") pi.versionCode.toLong()
    } catch (e: Exception) { Long.MAX_VALUE }

    private fun checkMandatoryUpdate(cfg: JSONObject) {
        val u = AppConfig.update(cfg)
        if (!u.mandatory) { updateDialog?.dismiss(); updateDialog = null; return }
        val current = installedVersionCode()
        if (u.minVersionCode > 0 && current >= u.minVersionCode) { updateDialog?.dismiss(); updateDialog = null; return }
        appUpdateManager.appUpdateInfo.addOnCompleteListener { task ->
            val info = if (task.isSuccessful) task.result else null
            val avail = info?.updateAvailability()
            val playCanUpdate = info != null &&
                (avail == com.google.android.play.core.install.model.UpdateAvailability.UPDATE_AVAILABLE ||
                 avail == com.google.android.play.core.install.model.UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) &&
                info.isUpdateTypeAllowed(com.google.android.play.core.install.model.AppUpdateType.IMMEDIATE)
            if (playCanUpdate) {
                try {
                    appUpdateManager.startUpdateFlowForResult(
                        info!!, updateLauncher,
                        com.google.android.play.core.appupdate.AppUpdateOptions.newBuilder(
                            com.google.android.play.core.install.model.AppUpdateType.IMMEDIATE
                        ).build()
                    )
                    return@addOnCompleteListener
                } catch (e: Exception) {
                    Log.w("KidsQuizUpdate", "immediate update failed", e)
                }
            }
            // No minimum set and Play says there's nothing newer: nothing to force.
            if (u.minVersionCode <= 0 && avail != com.google.android.play.core.install.model.UpdateAvailability.UPDATE_AVAILABLE) return@addOnCompleteListener
            showUpdateDialog(u.message)
        }
    }

    private fun showUpdateDialog(message: String) {
        if (updateDialog?.isShowing == true || isFinishing) return
        updateDialog = AlertDialog.Builder(this)
            .setTitle("Update needed")
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("Update now", null)
            .create().apply {
                setOnShowListener {
                    // Keep the dialog open: the button only opens the Play Store.
                    getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener { openPlayListing() }
                }
                show()
            }
    }

    private fun openPlayListing() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName")).apply {
                setPackage("com.android.vending"); addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (e: ActivityNotFoundException) {
            openUrl("https://play.google.com/store/apps/details?id=$packageName")
        }
    }

    override fun onResume() {
        super.onResume()
        checkMandatoryUpdate(AppConfig.load(this))   // came back from the Play Store / Google's update screen
    }

    private fun applyConfig(cfg: JSONObject, fromNetwork: Boolean) {
        offlineAllowed = AppConfig.offlineAllowed(cfg)
        bannerOn = AppConfig.bannerOn(cfg)
        if (fromNetwork) applyAdRequestConfig(AppConfig.testDevices(cfg))
        if (fromNetwork) checkMandatoryUpdate(cfg)
        Reminders.schedule(this)
        if (fromNetwork) sendToPage("window.onAppConfig && window.onAppConfig(" + cfg.toString() + ")")
        maybeAskNotificationPermission(cfg)
    }

    // Android 13+: reminders need permission to post notifications. Ask once a
    // day at most, only when reminders are switched on and someone is signed in.
    private fun maybeAskNotificationPermission(cfg: JSONObject) {
        if (Build.VERSION.SDK_INT < 33 || authMode.isEmpty()) return
        if (!AppConfig.reminder(cfg).enabled) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        val prefs = getSharedPreferences("kq_config", Context.MODE_PRIVATE)
        val last = prefs.getLong("notifAskedAt", 0L)
        if (System.currentTimeMillis() - last < 24 * 60 * 60 * 1000L) return
        prefs.edit().putLong("notifAskedAt", System.currentTimeMillis()).apply()
        notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun webCacheMode(): Int =
        if (offlineAllowed && !isNetworkAvailable()) WebSettings.LOAD_CACHE_ELSE_NETWORK else WebSettings.LOAD_DEFAULT

    // ==================================================
    // SHARE A PICTURE (score card made by the page) -> Android share sheet
    // ==================================================
    private fun shareImage(dataUrl: String?, text: String?) {
        if (dataUrl.isNullOrBlank()) return
        try {
            val bytes = android.util.Base64.decode(dataUrl.substringAfter("base64,", dataUrl), android.util.Base64.DEFAULT)
            val dir = java.io.File(cacheDir, "share").apply { mkdirs() }
            val file = java.io.File(dir, "kids-quiz-score.png").apply { writeBytes(bytes) }
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                if (!text.isNullOrBlank()) putExtra(Intent.EXTRA_TEXT, text)
                clipData = ClipData.newRawUri("score", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(send, "Share your score"))
        } catch (e: Exception) {
            Log.w("KidsQuizShare", "shareImage failed", e)
            Toast.makeText(this, "Couldn't share right now", Toast.LENGTH_SHORT).show()
        }
    }

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

        // Debug builds only: allow Chrome DevTools to inspect the WebView (never in release).
        if (0 != (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // ==================================================
        // ADMOB FOR A CHILDREN'S APP (Google Play Families policy + COPPA/GDPR)
        // Set BEFORE initialize() and before any ad is requested, so every
        // request carries these settings:
        //  - child-directed (COPPA): no personalised ads, no interest-based
        //    targeting or remarketing, only Families-certified ad sources
        //  - under the age of consent (GDPR / EEA)
        //  - only G-rated ads ("general audiences")
        // The advertising ID permission is removed in AndroidManifest.xml, and
        // Firebase Analytics doesn't collect it either.
        // ==================================================
        applyAdRequestConfig(AppConfig.testDevices(AppConfig.load(this)))
        // AdMob test device ID of this phone: shown in Logcat (filter: KidsQuizAds)
        // and in the admin console (Ad networks -> Test devices).
        Log.i("KidsQuizAds", "AdMob test device ID: $testDeviceId  (add it in Admin -> App settings -> Ad networks -> Test devices)")
        // Start AdMob + every mediation adapter (Chartboost, Unity, Liftoff,
        // DT Exchange). Their status is kept for the admin console
        // (Android.getAdNetworks) and written to Logcat (tag KidsQuizAds).
        MobileAds.initialize(this) { st ->
            val o = JSONObject()
            st.adapterStatusMap.forEach { (name, s) ->
                Log.d("KidsQuizAds", "adapter $name: ${s.initializationState} ${s.latency}ms ${s.description}")
                o.put(name, JSONObject()
                    .put("state", s.initializationState.name)
                    .put("ms", s.latency)
                    .put("info", s.description ?: ""))
            }
            adNetworkStatus = o.toString()
        }

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

        // Admin-console settings: last saved copy now, fresh copy from Firebase next.
        applyConfig(AppConfig.load(this), fromNetwork = false)
        lifecycleScope.launch {
            AppConfig.refresh(this@MainActivity)?.let { applyConfig(it, fromNetwork = true) }
        }

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
                            runOnUiThread { if (::webView.isInitialized) webView.settings.cacheMode = webCacheMode() }
                        }
                        override fun onLost(network: Network) {
                            isConnected = isNetworkAvailable()
                            runOnUiThread { if (::webView.isInitialized) webView.settings.cacheMode = webCacheMode() }
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

                            if (!isConnected && !offlineAllowed) {
                                // Admin setting "offline play" is off: internet required.
                                NoInternetScreen(
                                    onRetry = {
                                        if (isNetworkAvailable()) {
                                            isConnected = true
                                            reloadTrigger++
                                        }
                                    }
                                )
                            } else if (authMode.isEmpty()) {
                                // Not signed in yet: native login screen first.
                                LoginScreen()
                            } else {
                                key(reloadTrigger) {
                                    WebViewScreen(
                                        modifier =
                                            Modifier.fillMaxSize()
                                    )
                                }
                            }
                        }

                        // FIXED BOTTOM BANNER (not on the login screen)
                        // (switch on/off in Admin console -> App settings)
                        if (authMode.isNotEmpty() && bannerOn) BannerAd()
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

    // ==================================================
    // NATIVE PLAY RATING (Google Play In-App Review)
    // The star-rating sheet appears inside the app - no trip to the Play Store.
    // The page decides WHEN (after N finished quizzes/games, set in the admin
    // console); Google decides whether it actually shows (it limits how often a
    // person sees it, and it never shows in a sideloaded/debug install).
    // ==================================================
    private val reviewManager by lazy { com.google.android.play.core.review.ReviewManagerFactory.create(this) }
    private var reviewInProgress = false

    private fun requestReview() {
        if (reviewInProgress) return
        reviewInProgress = true
        reviewManager.requestReviewFlow().addOnCompleteListener { req ->
            if (req.isSuccessful) {
                reviewManager.launchReviewFlow(this, req.result).addOnCompleteListener {
                    reviewInProgress = false
                    Log.d("KidsQuizReview", "review flow finished")
                    sendToPage("window.onReviewDone && window.onReviewDone()")
                }
            } else {
                reviewInProgress = false
                Log.w("KidsQuizReview", "requestReviewFlow failed", req.exception)
            }
        }
    }

    // Older pages call showRatingPrompt(): use the native sheet now.
    private fun showRatingPrompt() = requestReview()

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
    // OPEN INSTAGRAM (APP FIRST)
    // 1. Instagram app with the normal profile URL (what current Instagram
    //    versions handle), targeted with setPackage -> no "choose an app" popup
    // 2. Instagram's own scheme: instagram://user?username=<name>
    // 3. Not installed: the profile in the browser (not the Play Store page
    //    for Instagram — people want to see our profile, not install an app)
    // ==================================================
    private fun openInstagramLink(url: String) {
        val username = Uri.parse(url).pathSegments
            .firstOrNull { it.isNotBlank() && it != "_u" }
            ?.trim()
        val profileUrl = if (!username.isNullOrBlank())
            "https://www.instagram.com/$username/" else url

        val attempts = mutableListOf(
            Intent(Intent.ACTION_VIEW, Uri.parse(profileUrl)).setPackage("com.instagram.android")
        )
        if (!username.isNullOrBlank()) {
            attempts.add(
                Intent(Intent.ACTION_VIEW, Uri.parse("instagram://user?username=$username"))
                    .setPackage("com.instagram.android")
            )
        }
        for (intent in attempts) {
            try {
                startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return
            } catch (e: ActivityNotFoundException) {
                // try the next way
            } catch (e: SecurityException) {
                // try the next way
            }
        }

        // Instagram not installed (or can't take the link): profile in the browser.
        try {
            startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(profileUrl)).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (e: ActivityNotFoundException) {
            openInstagramOnPlayStore()
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

                        // Offline play (admin setting): load saved pages when there's no internet
                        cacheMode =
                            webCacheMode()
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
        val handler = remember { android.os.Handler(android.os.Looper.getMainLooper()) }
        var adViewRef by remember { mutableStateOf<AdView?>(null) }

        // Free the banner when it leaves the screen (banner switched off, sign-out).
        DisposableEffect(Unit) {
            onDispose { handler.removeCallbacksAndMessages(null); adViewRef?.destroy() }
        }

        AndroidView(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (adShown) Modifier.wrapContentHeight() else Modifier.height(0.dp)),

            factory = { context ->

                AdView(context).apply {
                    adViewRef = this

                    // Anchored adaptive banner: full screen width, height chosen by
                    // Google for this phone. Fills better than the fixed 320x50.
                    val dm = context.resources.displayMetrics
                    setAdSize(
                        AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(
                            context, (dm.widthPixels / dm.density).toInt()
                        )
                    )

                    adUnitId =
                        bannerAdId

                    var fails = 0
                    val retry = Runnable { loadAd(AdRequest.Builder().build()) }

                    adListener = object : AdListener() {
                        override fun onAdLoaded() {
                            adShown = true
                            fails = 0
                            noteAd("banner", null)
                        }

                        override fun onAdFailedToLoad(error: LoadAdError) {
                            // A failed refresh keeps the previous ad on screen.
                            // Until one has loaded, try again: 30 s, 60 s, 2 min ...
                            // up to 5 min (kids-safe ads often have no fill at first).
                            noteAd("banner", error)
                            if (!adShown) {
                                fails++
                                val wait = minOf(300_000L, 30_000L shl minOf(fails - 1, 4))
                                handler.removeCallbacks(retry)
                                handler.postDelayed(retry, wait)
                            }
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

        // Settings from the admin console (last saved copy; works offline).
        // Usage in JS:  JSON.parse(Android.getAppConfig())
        @JavascriptInterface
        fun getAppConfig(): String = AppConfig.raw(this@MainActivity)

        // Player's country for the leaderboard flag (ISO code like "IN"):
        // SIM country, then mobile network country. No permission or location
        // needed. Returns "" otherwise - the page then uses the device time zone
        // (the phone's language setting is often en-US even in India).
        // Usage in JS:  Android.getCountry()
        @JavascriptInterface
        fun getCountry(): String {
            return try {
                val tm = getSystemService(Context.TELEPHONY_SERVICE) as? android.telephony.TelephonyManager
                listOf(tm?.simCountryIso, tm?.networkCountryIso)
                    .map { (it ?: "").trim().uppercase(Locale.ROOT) }
                    .firstOrNull { it.length == 2 } ?: ""
            } catch (e: Exception) { "" }
        }

        // Usage in JS:  Android.isOnline()
        @JavascriptInterface
        fun isOnline(): Boolean = isNetworkAvailable()

        // Share a picture made by the page (data:image/png;base64,...) with
        // the Android share sheet (WhatsApp, Instagram, ...).
        // Usage in JS:  Android.shareImage(canvas.toDataURL('image/png'), 'text')
        @JavascriptInterface
        fun shareImage(dataUrl: String?, text: String?) {
            runOnUiThread { this@MainActivity.shareImage(dataUrl, text) }
        }

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

        // Coins: "watch a video to play". Rewarded video, else rewarded
        // interstitial; answer comes back via window.onRewardResult(id, status).
        // Usage in JS:  Android.showRewardFor('abc123')
        @JavascriptInterface
        fun showRewardFor(id: String?) {
            runOnUiThread { this@MainActivity.showRewardFor(id) }
        }

        // Is a rewarded video (or rewarded interstitial) ready right now?
        // Usage in JS:  Android.isRewardReady()
        @JavascriptInterface
        fun isRewardReady(): Boolean = rewardedAd != null || rewardedInterstitialAd != null

        // Ad networks (AdMob mediation adapters) and whether each one started.
        // Usage in JS:  JSON.parse(Android.getAdNetworks())
        //   -> { "<adapter class>": { state: "READY" | "NOT_READY", ms, info } }
        @JavascriptInterface
        fun getAdNetworks(): String = adNetworkStatus

        // AdMob test device ID of this phone. Usage in JS:  Android.getTestDeviceId()
        @JavascriptInterface
        fun getTestDeviceId(): String = testDeviceId

        // Weekly report for parents (Sunday 18:00 notification).
        // Usage in JS:  Android.setWeeklyReport(title, text, "<end of week, ms>")
        @JavascriptInterface
        fun setWeeklyReport(title: String?, text: String?, until: String?) {
            Reminders.saveWeekly(this@MainActivity, title ?: "", text ?: "", until?.toLongOrNull() ?: 0L)
        }

        // Share plain text (league class code). Usage in JS:  Android.shareText(text)
        @JavascriptInterface
        fun shareText(text: String?) {
            if (text.isNullOrBlank()) return
            runOnUiThread {
                try {
                    startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }, "Share"))
                } catch (e: Exception) { }
            }
        }

        // Last load result per ad type: { banner: "<ms>|loaded" | "<ms>|error 3: No fill [..]", ... }
        // Usage in JS:  JSON.parse(Android.getAdLoadStatus())
        @JavascriptInterface
        fun getAdLoadStatus(): String = JSONObject(adLoadStatus as Map<*, *>).toString()

        // Google's Ad Inspector: every ad unit, its mediation networks and test
        // requests. Opens only on an AdMob test device (AdMob -> Settings ->
        // Test devices). Usage in JS:  Android.openAdInspector()
        @JavascriptInterface
        fun openAdInspector() {
            runOnUiThread {
                MobileAds.openAdInspector(this@MainActivity) { err ->
                    if (err != null) {
                        Log.d("KidsQuizAds", "Ad Inspector: ${err.code} ${err.message}")
                        Toast.makeText(this@MainActivity, "Ad Inspector: " + err.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        // Native Play rating sheet (In-App Review).
        // Usage in JS:  Android.requestReview();
        @JavascriptInterface
        fun requestReview() {
            runOnUiThread { this@MainActivity.requestReview() }
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
                    noteAd("interstitial", null)
                }

                override fun
                        onAdFailedToLoad(
                    error: LoadAdError
                ) {
                    interstitialAd = null
                    noteAd("interstitial", error)
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
                    noteAd("rewarded", null)
                }

                override fun
                        onAdFailedToLoad(
                    error: LoadAdError
                ) {
                    rewardedAd = null
                    noteAd("rewarded", error)
                }
            }
        )
    }

    // ==================================================
    // "WATCH A VIDEO TO PLAY" (coins feature)
    // Rewarded video first; if none is ready, the rewarded interstitial.
    // Tells the page how it went: window.onRewardResult(id, status)
    //   status: "earned" (watched to the end), "closed" (closed early),
    //           "none" (no ad available right now)
    // ==================================================
    private fun showRewardFor(id: String?) {
        val token = (id ?: "").replace(Regex("[^A-Za-z0-9_-]"), "").take(40)
        var earned = false
        fun report(status: String) = sendToPage("window.onRewardResult && window.onRewardResult('$token','$status')")
        fun reload() {
            if (rewardedAd == null) loadRewardedAd()
            if (rewardedInterstitialAd == null) loadRewardedInterstitialAd()
        }
        val callback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { report(if (earned) "earned" else "closed"); reload() }
            override fun onAdFailedToShowFullScreenContent(error: AdError) { report("none"); reload() }
        }
        val r = rewardedAd
        if (r != null) {
            rewardedAd = null
            r.fullScreenContentCallback = callback
            r.show(this) { earned = true }
            return
        }
        val ri = rewardedInterstitialAd
        if (ri != null) {
            rewardedInterstitialAd = null
            ri.fullScreenContentCallback = callback
            ri.show(this) { earned = true }
            return
        }
        reload()
        report("none")
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
                    noteAd("rewarded_interstitial", null)
                }

                override fun
                        onAdFailedToLoad(
                    error: LoadAdError
                ) {
                    rewardedInterstitialAd =
                        null
                    noteAd("rewarded_interstitial", error)
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