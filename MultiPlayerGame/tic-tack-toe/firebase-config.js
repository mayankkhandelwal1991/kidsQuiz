/**
 * firebase-config.js
 * -----------------------------------------------------------------------
 * PASTE YOUR OWN FIREBASE PROJECT CONFIG BELOW.
 *
 * How to get this object:
 *   1. Go to https://console.firebase.google.com
 *   2. Create a project (or open an existing one).
 *   3. Project settings (gear icon) -> General -> "Your apps" -> Web app (</>)
 *   4. Copy the firebaseConfig object shown there and paste it below.
 *   5. Make sure you've enabled "Realtime Database" (not Firestore) in the
 *      Firebase console, in test mode or with the rules from README.md.
 *
 * This file must be loaded with a plain <script> tag AFTER the Firebase
 * compat SDK scripts and BEFORE js/game.js — see index.html.
 * -----------------------------------------------------------------------
 */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB0eMyeIUtCsuMVk-8LtRQs_iwOJV3ksv8",
  authDomain: "kidsgames-3987c.firebaseapp.com",
  databaseURL: "https://kidsgames-3987c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kidsgames-3987c",
  storageBucket: "kidsgames-3987c.appspot.com",
  messagingSenderId: "851797718600",
  appId: "1:851797718600:web:e990b3435751d209228a7d",
  measurementId: "G-3JDMHBXKRK"
};

// Initialize the Firebase app using the compat SDK (loaded via <script> tags
// in index.html). Using the compat build keeps this project dependency-free
// and buildless — no npm/webpack/bundler required, just open index.html.
firebase.initializeApp(firebaseConfig);
