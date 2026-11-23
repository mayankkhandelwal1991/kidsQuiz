plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
// Add the Google services Gradle plugin
    id("com.google.gms.google-services")

}

android {
    namespace = "com.mk.kidsquiz"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.mk.kidsquiz"
        minSdk = 24
        targetSdk = 36
        versionCode = 15
        versionName = "1.0.13"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            // R8: removes unused code + resources (much smaller download).
            // Keep rules for the WebView bridge are in proguard-rules.pro.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)

    implementation("com.google.android.gms:play-services-ads:25.5.0")

    // AdMob mediation adapters. Only ad networks on Google Play's Families
    // Self-Certified Ads SDK list (this is a kids app). Each network is switched
    // on/off and given its IDs in AdMob -> Mediation, not here: an adapter does
    // nothing until a mediation group uses it. Check each new version in the
    // Play SDK Index before updating.
    implementation("com.google.ads.mediation:chartboost:9.14.1.0")   // Chartboost
    implementation("com.google.ads.mediation:unity:4.21.0.0")        // Unity Ads
    implementation("com.unity3d.ads:unity-ads:4.21.0")               //   (adapter doesn't include the SDK)
    implementation("com.google.ads.mediation:vungle:7.8.0.0")        // Liftoff Monetize (Vungle)
    implementation("com.google.ads.mediation:fyber:8.5.1.0")         // DT Exchange (Digital Turbine)

    // Google Sign-In (Credential Manager + Sign in with Google). Replaces the
    // deprecated play-services-auth GoogleSignIn API.
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Import the Firebase BoM
    implementation(platform("com.google.firebase:firebase-bom:34.16.0"))
    // When using the BoM, don't specify versions in Firebase dependencies
    implementation("com.google.firebase:firebase-analytics")

    implementation("com.google.android.play:app-update-ktx:2.1.0")
    // Google Play In-App Review: the native star-rating sheet inside the app
    implementation("com.google.android.play:review-ktx:2.0.2")

    // In dependencies block
    implementation("com.google.firebase:firebase-messaging-ktx:24.1.0")

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}