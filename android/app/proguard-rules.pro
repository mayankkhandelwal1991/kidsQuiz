# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
# ---------------------------------------------------------------------------
# Kids Quiz
# The web pages call these methods by name through the "Android" JavaScript
# bridge (Android.showAd, googleSignIn, getAuthSession, shareImage,
# requestReview, ...). Nothing in Kotlin calls them, so without these rules R8
# would rename or delete them and the pages' calls would silently do nothing.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.mk.kidsquiz.MainActivity$WebAppInterface { *; }

# Better crash reports in Play Console (with the uploaded mapping file).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
