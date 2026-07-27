/**
 * common/firebase-config.js
 * -----------------------------------------------------------------------
 * ONE Firebase config shared by every game in this project. Every game
 * folder loads this same file via a relative <script> tag, so you only
 * ever need to update your project credentials in this single place.
 *
 * All games write under their own top-level `games/{gameId}/...` path in
 * the same Realtime Database, so they never collide with each other even
 * though they share one Firebase project.
 * -----------------------------------------------------------------------
 */

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

// Guard against re-initialization if a page ever loads this twice.
if (!window.firebase.apps || !window.firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
