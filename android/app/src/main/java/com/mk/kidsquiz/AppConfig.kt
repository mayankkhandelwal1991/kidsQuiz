package com.mk.kidsquiz

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * App settings controlled from the web admin console (Admin console -> App settings).
 *
 * Stored in Firebase Realtime Database at /config/app (public read, admin-only write).
 * The app downloads it on every launch (plain REST GET, no extra SDK) and keeps the
 * last copy in SharedPreferences so it also works offline.
 *
 * {
 *   "reminder": { "enabled": true, "frequency": "daily"|"weekly", "time": "18:00",
 *                 "weekday": 0..6 (0 = Sunday), "title": "...", "body": "..." },
 *   "offline":  { "enabled": false },          // allow playing without internet
 *   "share":    { "enabled": true },           // "Share score" picture button
 *   "app":      { "hideLeaderboardFab": true },// hide floating 🏆 inside the app
 *   "ads":      { "banner": true, "everyN": 2, "minGapSec": 60, "quit": true },
 *   "rating":   { "enabled": true, "afterN": 3, "repeatDays": 30 },  // (used by the page)
 *   "update":   { "mandatory": false, "minVersionCode": 0, "message": "..." }
 * }
 */
object AppConfig {
    private const val TAG = "KidsQuizConfig"
    private const val URL_CONFIG =
        "https://kidsgames-3987c-default-rtdb.asia-southeast1.firebasedatabase.app/config/app.json"
    private const val PREFS = "kq_config"
    private const val KEY = "json"

    data class Reminder(
        val enabled: Boolean,
        val weekly: Boolean,
        val hour: Int,
        val minute: Int,
        val weekday: Int,
        val title: String,
        val body: String
    )

    fun load(ctx: Context): JSONObject = try {
        JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "{}") ?: "{}")
    } catch (e: Exception) {
        JSONObject()
    }

    fun raw(ctx: Context): String = load(ctx).toString()

    /** Download the latest settings; returns them (and saves them) or null when offline. */
    suspend fun refresh(ctx: Context): JSONObject? = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            conn = (URL(URL_CONFIG).openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 8000
                useCaches = false
            }
            if (conn.responseCode != 200) return@withContext null
            val body = conn.inputStream.bufferedReader().use { it.readText() }.trim()
            val json = if (body.isEmpty() || body == "null") JSONObject() else JSONObject(body)
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json.toString()).apply()
            json
        } catch (e: Exception) {
            Log.d(TAG, "config refresh failed: ${e.message}")
            null
        } finally {
            conn?.disconnect()
        }
    }

    fun reminder(cfg: JSONObject): Reminder {
        val r = cfg.optJSONObject("reminder") ?: JSONObject()
        val freq = r.optString("frequency", "daily")
        val time = r.optString("time", "18:00").split(":")
        val hour = time.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 18
        val minute = time.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 0
        return Reminder(
            enabled = r.optBoolean("enabled", false) && freq != "off",
            weekly = freq == "weekly",
            hour = hour,
            minute = minute,
            weekday = r.optInt("weekday", 0).coerceIn(0, 6),
            title = r.optString("title", "").ifBlank { "Your daily mission is ready! 🚀" },
            body = r.optString("body", "").ifBlank { "Play a quick quiz or game and keep your streak going ⭐" }
        )
    }

    fun offlineAllowed(cfg: JSONObject): Boolean =
        cfg.optJSONObject("offline")?.optBoolean("enabled", false) ?: false

    data class Update(val mandatory: Boolean, val minVersionCode: Long, val message: String)

    fun update(cfg: JSONObject): Update {
        val u = cfg.optJSONObject("update") ?: JSONObject()
        return Update(
            mandatory = u.optBoolean("mandatory", false),
            minVersionCode = u.optLong("minVersionCode", 0L),
            message = u.optString("message", "").ifBlank {
                "A new version of Kids Quiz is ready with new games and fixes. Please update to keep playing."
            }
        )
    }

    fun bannerOn(cfg: JSONObject): Boolean =
        cfg.optJSONObject("ads")?.optBoolean("banner", true) ?: true

    /** AdMob test device IDs (admin console -> App settings -> Ad networks). */
    fun testDevices(cfg: JSONObject): List<String> {
        val v = cfg.optJSONObject("ads")?.opt("testDevices") ?: return emptyList()
        val raw = when (v) {
            is org.json.JSONArray -> (0 until v.length()).map { v.optString(it) }
            is JSONObject -> v.keys().asSequence().map { v.optString(it) }.toList()
            else -> v.toString().split(',', ' ', '\n')
        }
        return raw.map { it.trim().uppercase() }.filter { it.length >= 16 }.distinct()
    }
}
