package app.volapace;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Local reminders only (AlarmManager + NotificationManager); no push service.
 * The UI sends its settings with setReminder(); they are kept in preferences so the alarms can be
 * rescheduled after a reboot or a time-zone change without opening the app.
 *
 *  daily   - at the chosen time, unless today's goal is already met; moved past quiet hours.
 *  rescue  - at its own time (9 PM by default), only when a streak is running and today isn't done yet.
 */
final class Reminders {
    static final String CHANNEL = "reminders";
    static final int DAILY = 1, RESCUE = 2;
    private static final String PREFS = "reminders";
    private static final String[] DAYS = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, 0).edit().putString("cfg", json).apply();
        schedule(c);
    }

    static JSONObject cfg(Context c) {
        try { return new JSONObject(c.getSharedPreferences(PREFS, 0).getString("cfg", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static String today() { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime()); }

    static void schedule(Context c) {
        JSONObject cfg = cfg(c);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        cancel(c, am, DAILY); cancel(c, am, RESCUE);
        if (cfg.optBoolean("on")) {
            int[] hm = parse(cfg.optString("time", "20:00"));
            set(c, am, DAILY, next(hm[0], hm[1], cfg.optJSONObject("quiet")));
        }
        if (cfg.optBoolean("rescue")) { int[] r = parse(cfg.optString("rescueTime", "21:00")); set(c, am, RESCUE, next(r[0], r[1], null)); }
    }

    /** Called when an alarm fires: post if still useful, then schedule the next one. */
    static void fire(Context c, int which) {
        JSONObject cfg = cfg(c);
        boolean doneToday = today().equals(cfg.optString("lastDone"));
        if (!doneToday) {
            if (which == DAILY && cfg.optBoolean("on")) post(c, DAILY, "Time to read", cfg.optString("text", "Pick up where you left off."));
            if (which == RESCUE && cfg.optBoolean("rescue")) post(c, RESCUE, "Keep your streak alive", "You haven’t read today yet. A few pages will do.");
        }
        schedule(c);
    }

    private static void post(Context c, int id, String title, String text) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, c.getString(R.string.channel_reminders), NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription(c.getString(R.string.channel_reminders_desc));
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFFD90429)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        try { nm.notify(id, n); } catch (SecurityException ignored) {} // notifications not allowed
    }

    private static void set(Context c, AlarmManager am, int which, long at) {
        if (am == null) return;
        // Inexact is fine for a reading nudge and needs no special permission.
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c, which));
    }
    private static void cancel(Context c, AlarmManager am, int which) { if (am != null) am.cancel(pending(c, which)); }
    private static PendingIntent pending(Context c, int which) {
        Intent i = new Intent(c, ReminderReceiver.class).putExtra("which", which);
        return PendingIntent.getBroadcast(c, which, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Next time h:m happens (today or later); if it falls in quiet hours, move it to their end. */
    static long next(int h, int m, JSONObject quiet) {
        Calendar now = Calendar.getInstance();
        Calendar t = (Calendar) now.clone();
        t.set(Calendar.HOUR_OF_DAY, h); t.set(Calendar.MINUTE, m); t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
        if (!t.after(now)) t.add(Calendar.DAY_OF_YEAR, 1);
        if (quiet != null) {
            int[] from = parse(quiet.optString("from", "09:00")), to = parse(quiet.optString("to", "17:00"));
            Set<String> days = new HashSet<>();
            JSONArray d = quiet.optJSONArray("days");
            if (d != null) for (int i = 0; i < d.length(); i++) days.add(d.optString(i));
            int fm = from[0] * 60 + from[1], tm = to[0] * 60 + to[1], x = h * 60 + m;
            boolean inside = fm <= tm ? x >= fm && x < tm : x >= fm || x < tm;
            if (inside && days.contains(DAYS[t.get(Calendar.DAY_OF_WEEK) - 1])) {
                if (fm > tm && x >= fm) t.add(Calendar.DAY_OF_YEAR, 1);
                t.set(Calendar.HOUR_OF_DAY, to[0]); t.set(Calendar.MINUTE, to[1]);
            }
        }
        return t.getTimeInMillis();
    }

    private static int[] parse(String hm) {
        try { String[] p = hm.split(":"); return new int[]{Integer.parseInt(p[0]), Integer.parseInt(p[1])}; } catch (Exception e) { return new int[]{20, 0}; }
    }
}
