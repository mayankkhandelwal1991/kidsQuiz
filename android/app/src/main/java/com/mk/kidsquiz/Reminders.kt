package com.mk.kidsquiz

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.Calendar

/**
 * Daily / weekly reminder notification. Time, frequency, on/off and text come from
 * the admin console (AppConfig "reminder"). Uses AlarmManager (no extra library):
 * one alarm at a time; when it fires we show the notification and schedule the next.
 * Re-scheduled on app start, after a reboot and after an app update.
 */
object Reminders {
    const val ACTION_FIRE = "com.mk.kidsquiz.REMINDER"
    private const val CHANNEL_ID = "kq_reminders"
    private const val REQ = 7101
    private const val NOTIF_ID = 7102

    private fun pending(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(
            ctx, REQ,
            Intent(ctx, ReminderReceiver::class.java).setAction(ACTION_FIRE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    /** (Re)schedule from the saved settings; cancels when reminders are off. */
    fun schedule(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pending(ctx)
        am.cancel(pi)
        val r = AppConfig.reminder(AppConfig.load(ctx))
        if (!r.enabled) return
        val next = nextTime(r, System.currentTimeMillis())
        // A 10-minute window: on time without the exact-alarm permission. (A plain
        // inexact alarm let Android delay a "6 pm" reminder by many hours.)
        am.setWindow(AlarmManager.RTC_WAKEUP, next, 10 * 60 * 1000L, pi)
    }

    fun nextTime(r: AppConfig.Reminder, now: Long): Long {
        val c = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, r.hour)
            set(Calendar.MINUTE, r.minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (r.weekly) set(Calendar.DAY_OF_WEEK, r.weekday + 1) // Calendar.SUNDAY == 1
        }
        while (c.timeInMillis <= now + 30_000) c.add(if (r.weekly) Calendar.WEEK_OF_YEAR else Calendar.DAY_OF_YEAR, 1)
        return c.timeInMillis
    }

    fun show(ctx: Context) {
        val r = AppConfig.reminder(AppConfig.load(ctx))
        if (!r.enabled) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL_ID) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Daily reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "A friendly reminder to play and learn"
                }
            )
        }
        val open = PendingIntent.getActivity(
            ctx, 0,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val n = NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(r.title)
            .setContentText(r.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(r.body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(NOTIF_ID, n) } catch (e: SecurityException) { }
    }
}

/** Fires the reminder, then schedules the next one. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Reminders.ACTION_FIRE) Reminders.show(context)
        Reminders.schedule(context)
    }
}

/** Alarms are cleared on reboot / app update: put the reminder back. */
class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> Reminders.schedule(context)
        }
    }
}
