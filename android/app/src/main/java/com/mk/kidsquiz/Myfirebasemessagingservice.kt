package com.mk.kidsquiz

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Notifications sent from the admin console (admin/users.html#push -> admin/api.php -> FCM).
 * They arrive as DATA messages {type, title, body, link, id}, so this code always builds
 * the notification itself (also when the app is closed):
 *   type  -> channel (parents can mute each kind in Android settings):
 *            news (announcements, new things), reminder, homework (teachers), report (parents)
 *   link  -> what opens on tap: "report" (weekly report, behind the grown-up question)
 *            or a page of the app such as "stories/index.html".
 * Topics ("all", "class_lkg", "teachers", "like_maths" ...) are chosen by the page
 * (push.js -> Android.pushRegister) and kept in sync here. A parent can switch all
 * notifications off (For parents); then nothing is shown.
 */
class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FCMService"
        const val PREFS = "kq_push"

        // type -> channel id, name, description
        val CHANNEL_INFO = mapOf(
            "news" to Triple("kq_news", "News & new things", "New stories, games and announcements"),
            "reminder" to Triple("kq_remind", "Play reminders", "A friendly reminder to learn and play"),
            "homework" to Triple("kq_homework", "Homework & teachers", "Messages for teachers and classes"),
            "report" to Triple("kq_report", "Parent reports", "Your child's weekly progress")
        )

        /** Local notification in the same channels (ClassWatch: new test from the teacher). */
        fun showLocal(ctx: Context, type: String, title: String, body: String, link: String, id: Int) {
            if (isOff(ctx)) return
            kqShowNotification(ctx, type, title, body, link, id)
        }

        fun isOff(ctx: Context): Boolean = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("off", false)

        /** Subscribe to exactly these topics (unsubscribe the old ones); off = no topics at all. */
        fun syncTopics(ctx: Context, topics: List<String>, enabled: Boolean) {
            val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val want = if (enabled) topics.filter { it.matches(Regex("^[a-z0-9_-]{2,60}$")) }.toSet() else emptySet()
            val had = p.getStringSet("topics", emptySet()) ?: emptySet()
            val fm = FirebaseMessaging.getInstance()
            (had - want).forEach { t -> fm.unsubscribeFromTopic(t) }
            (want - had).forEach { t -> fm.subscribeToTopic(t) }
            p.edit().putStringSet("topics", want).putBoolean("off", !enabled).apply()
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // The page saves it in Firebase the next time it asks (push.js -> Android.pushRegister).
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("token", token).putBoolean("tokenSent", false).apply()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        if (isOff(this)) return
        val d = remoteMessage.data
        val title = (d["title"] ?: remoteMessage.notification?.title ?: "Kids Quiz").take(80)
        val body = (d["body"] ?: remoteMessage.notification?.body ?: "").take(300)
        if (body.isBlank()) return
        val type = d["type"]?.takeIf { CHANNEL_INFO.containsKey(it) } ?: "news"
        val link = d["link"] ?: ""
        kqShowNotification(this, type, title, body, link, (d["id"] ?: System.currentTimeMillis().toString()).hashCode())
    }
}

private fun kqShowNotification(ctx: Context, type: String, title: String, body: String, link: String, id: Int) {
        val CHANNELS = MyFirebaseMessagingService.CHANNEL_INFO
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val ch = CHANNELS[type] ?: CHANNELS.getValue("news")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(ch.first) == null) {
                nm.createNotificationChannel(NotificationChannel(ch.first, ch.second, NotificationManager.IMPORTANCE_DEFAULT).apply { description = ch.third })
            }
        }
        // what to open: the weekly report, or a page of the app
        val action = when {
            link == "report" -> "report"
            link.matches(Regex("^[A-Za-z0-9_\\-/.]+(\\.html)?(#[A-Za-z0-9_\\-/.]*)?$")) -> "open:$link"
            else -> ""
        }
        val intent = Intent(ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (action.isNotEmpty()) putExtra(Reminders.EXTRA_ACTION, action)
        }
        val pi = PendingIntent.getActivity(ctx, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(ctx, ch.first)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(id, n) } catch (e: SecurityException) { Log.w("FCMService", "no permission") }
    }
