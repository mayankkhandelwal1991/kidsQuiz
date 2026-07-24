# Google Sign-In inside the Android WebView

## Why it fails in the app but works in Chrome

Google **deliberately blocks** its OAuth login screen inside embedded WebViews
(you'll see *Error 403: disallowed_useragent*). Firebase's web Google provider
(`signInWithPopup` / `signInWithRedirect`) uses that OAuth flow, so it can't work
in a plain WebView. This is a Google policy, not a bug in the page — there is no
pure-HTML/JS workaround.

**The supported fix:** do Google Sign-In **natively** in your Android app to get
a Google **ID token**, then pass that token into the page. The page finishes the
login with `firebase.auth().signInWithCredential(...)`.

The web side is already wired for this. When the page runs inside your app it
calls `Android.googleSignIn()` instead of the popup, and it exposes
`window.onGoogleIdToken('<idToken>')` for the app to call back. You just need to
add the native piece below.

---

## Step 1 — Get your Web client ID and register your app

1. Firebase console → **Authentication → Sign-in method → Google** must be
   enabled (you already did this).
2. Firebase console → **Project settings → Your apps → Android app**: add your
   app's **SHA-1** (and SHA-256) fingerprint, then download the updated
   `google-services.json` into your app module. (Google Sign-In only issues a
   valid token if the signing fingerprint is registered.)
3. Copy your **Web client ID**: Authentication → Google → *Web SDK
   configuration* → **Web client ID** (looks like
   `8517...apps.googleusercontent.com`). You'll paste it as `WEB_CLIENT_ID`.

---

## Step 2 — Gradle dependency

```gradle
// app/build.gradle
dependencies {
    implementation 'com.google.android.gms:play-services-auth:21.2.0'
}
```

---

## Step 3 — WebView settings

DOM storage must be on (Firebase JS Auth stores the session there), and the
JavaScript bridge must be named exactly `Android`:

```kotlin
webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
    databaseEnabled = true
    javaScriptCanOpenWindowsAutomatically = true
}
webView.addJavascriptInterface(WebAppInterface(), "Android")
```

---

## Step 4 — Activity code (Kotlin)

```kotlin
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.*
import com.google.android.gms.common.api.ApiException

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var googleClient: GoogleSignInClient

    // Paste your Firebase "Web client ID" here:
    private val WEB_CLIENT_ID = "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"

    // Receives the result of the Google account chooser.
    private val signInLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            try {
                val account = GoogleSignIn.getSignedInAccountFromIntent(result.data)
                    .getResult(ApiException::class.java)
                val idToken = account?.idToken
                if (idToken != null) {
                    // Hand the token to the web page to finish Firebase login.
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onGoogleIdToken && window.onGoogleIdToken('$idToken')",
                            null
                        )
                    }
                }
            } catch (e: ApiException) {
                // 12501 = user cancelled; ignore. Otherwise log e.statusCode.
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)   // or findViewById(...) from your layout
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            javaScriptCanOpenWindowsAutomatically = true
        }
        webView.addJavascriptInterface(WebAppInterface(), "Android")

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(WEB_CLIENT_ID)
            .requestEmail()
            .build()
        googleClient = GoogleSignIn.getClient(this, gso)

        webView.loadUrl("https://YOUR_HOSTED_SITE/quiz2.html")
    }

    // The page calls Android.googleSignIn() (via KQ.signIn) to start sign-in.
    inner class WebAppInterface {
        @JavascriptInterface
        fun googleSignIn() {
            // Sign out first so the account chooser always appears.
            googleClient.signOut().addOnCompleteListener {
                signInLauncher.launch(googleClient.signInIntent)
            }
        }

        @JavascriptInterface
        fun googleSignOut() {
            googleClient.signOut()
        }
    }
}
```

That's all. Flow at runtime:

1. User taps **Sign in with Google** on the page.
2. The page detects the WebView + `Android` bridge and calls
   `Android.googleSignIn()`.
3. Native Google account chooser appears; on success the app gets an ID token.
4. App runs `window.onGoogleIdToken('<token>')`.
5. The page calls `firebase.auth().signInWithCredential(...)`, the auth state
   flips to signed-in, and the mandatory gate lets the user through — exactly
   like it does in Chrome.

---

## Notes

- **Keep the `ads.js` `Android` bridge too.** Adding `googleSignIn()` /
  `googleSignOut()` to the same `Android` interface is fine — just make sure the
  interface is registered under the name `Android`.
- **Sign out:** the page's Sign out button already clears the Firebase JS
  session; calling `Android.googleSignOut()` additionally clears the cached
  Google account so the chooser reappears next time.
- **Alternative (no native code):** open the site in a **Chrome Custom Tab** or
  the external browser for login instead of a WebView. That allows Google's web
  OAuth, but sharing the signed-in session back into a WebView is awkward, so
  native sign-in above is the cleaner path for a packaged app.
- If you get token errors, 99% of the time the app's **SHA-1 isn't registered**
  in Firebase or the **Web client ID is wrong**.
