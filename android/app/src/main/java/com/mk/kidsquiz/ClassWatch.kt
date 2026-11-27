package com.mk.kidsquiz

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * "New test from Mrs Sharma" without a server: the page (class.js -> Android.watchClasses)
 * saves the class codes this child is in and the newest test it has already seen.
 * Every ~3 hours the phone reads tasks/<code> (public in the Firebase rules, newest only)
 * and shows a notification for a newer test. Tapping it opens the home page, where the
 * test is waiting under "My class". Nothing is sent when notifications are off.
 */
object ClassWatch {
    const val ACTION = "com.mk.kidsquiz.CLASS_CHECK"
    private const val PREFS = "kq_class_watch"
    private const val REQ = 7105
    private const val EVERY = 3 * 60 * 60 * 1000L
    private const val DB = "https://kidsgames-3987c-default-rtdb.asia-southeast1.firebasedatabase.app"
    private val CODE = Regex("^[A-Z0-9]{6}$")
    private val KEY = Regex("^[A-Za-z0-9_\\-]{1,40}$")

    /** From the page: [{code, tn, last}] (keeps a newer "last" the phone already notified). */
    fun save(ctx: Context, json: String) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val old = try { JSONArray(p.getString("list", "[]")) } catch (e: Exception) { JSONArray() }
        val oldLast = HashMap<String, String>()
        for (i in 0 until old.length()) old.optJSONObject(i)?.let { oldLast[it.optString("code")] = it.optString("last") }
        val out = JSONArray()
        val arr = JSONArray(json)
        for (i in 0 until minOf(arr.length(), 10)) {
            val o = arr.optJSONObject(i) ?: continue
            val code = o.optString("code")
            if (!code.matches(CODE)) continue
            var last = o.optString("last").takeIf { it.matches(KEY) } ?: ""
            val prev = oldLast[code] ?: ""
            if (prev > last) last = prev
            out.put(JSONObject().put("code", code).put("tn", o.optString("tn").take(20)).put("last", last))
        }
        p.edit().putString("list", out.toString()).apply()
        schedule(ctx)
    }

    private fun pending(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(ctx, REQ, Intent(ctx, ReminderReceiver::class.java).setAction(ACTION),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun schedule(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pending(ctx)
        am.cancel(pi)
        val list = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("list", "[]") ?: "[]"
        if (list == "[]") return
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + EVERY, EVERY, pi)
    }

    /** Runs on a background thread (ReminderReceiver uses goAsync). */
    fun check(ctx: Context) {
        if (MyFirebaseMessagingService.isOff(ctx)) return
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(p.getString("list", "[]")) } catch (e: Exception) { return }
        var changed = false
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val code = o.optString("code")
            if (!code.matches(CODE)) continue
            try {
                val q = "orderBy=" + URLEncoder.encode("\"\$key\"", "UTF-8") + "&limitToLast=1"
                val c = URL("$DB/tasks/$code.json?$q").openConnection() as HttpURLConnection
                c.connectTimeout = 15000; c.readTimeout = 15000
                val body = c.inputStream.bufferedReader().use { it.readText() }
                c.disconnect()
                if (body == "null") continue
                val tasks = JSONObject(body)
                val key = tasks.keys().asSequence().firstOrNull() ?: continue
                val last = o.optString("last")
                if (last.isNotEmpty() && key > last) {
                    val t = tasks.getJSONObject(key)
                    val who = t.optString("tn").ifBlank { o.optString("tn") }.ifBlank { "your teacher" }.take(20)
                    val what = if (t.optString("type") == "story") "story" else "test"
                    MyFirebaseMessagingService.showLocal(ctx, "homework", "📝 New $what from $who", t.optString("title").take(60) + " — tap to start", "quiz-home.html", code.hashCode())
                }
                if (last.isEmpty() || key > last) { o.put("last", key); changed = true }
            } catch (e: Exception) { }
        }
        if (changed) p.edit().putString("list", arr.toString()).apply()
    }
}
