package app.volapace;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Home-screen streak widget. The UI sends the days the daily goal was met (setWidget); the widget
 * works the streak out against the phone's own date, so it stays right after midnight without the
 * app being opened. Updates every 30 minutes and whenever the UI sends new data.
 */
public class StreakWidget extends AppWidgetProvider {
    private static final String PREFS = "widget";
    private static final int[] DOTS = {R.id.w_d0, R.id.w_d1, R.id.w_d2, R.id.w_d3, R.id.w_d4, R.id.w_d5, R.id.w_d6};
    private static final String[] LETTERS = {"S", "M", "T", "W", "T", "F", "S"};
    private static final int[] LABELS = {R.id.w_l0, R.id.w_l1, R.id.w_l2, R.id.w_l3, R.id.w_l4, R.id.w_l5, R.id.w_l6};

    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, 0).edit().putString("data", json).apply();
        refresh(c);
    }

    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, StreakWidget.class));
        if (ids != null && ids.length > 0) for (int id : ids) m.updateAppWidget(id, views(c));
    }

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, views(c));
    }

    private static String iso(Calendar d) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(d.getTime()); }

    private static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_streak);
        Set<String> done = new HashSet<>();
        String book = "";
        try {
            JSONObject o = new JSONObject(c.getSharedPreferences(PREFS, 0).getString("data", "{}"));
            JSONArray a = o.optJSONArray("days");
            if (a != null) for (int i = 0; i < a.length(); i++) done.add(a.optString(i));
            book = o.optString("book", "");
        } catch (Exception ignored) {}

        Calendar d = Calendar.getInstance();
        String today = iso(d);
        boolean todayDone = done.contains(today);
        Calendar k = Calendar.getInstance();
        if (!todayDone) k.add(Calendar.DATE, -1);
        int streak = 0;
        while (done.contains(iso(k)) && streak < 5000) { streak++; k.add(Calendar.DATE, -1); }

        v.setTextViewText(R.id.w_streak, String.valueOf(streak));
        v.setTextViewText(R.id.w_status, todayDone ? "Today done" : streak > 0 ? "Read today to keep it" : (book.isEmpty() ? "Start a streak today" : book));

        Calendar w = Calendar.getInstance();
        w.add(Calendar.DATE, -6);
        for (int i = 0; i < 7; i++) {
            boolean on = done.contains(iso(w));
            v.setImageViewResource(DOTS[i], on ? R.drawable.widget_dot_on : (i == 6 ? R.drawable.widget_dot_today : R.drawable.widget_dot_off));
            v.setTextViewText(LABELS[i], LETTERS[w.get(Calendar.DAY_OF_WEEK) - 1]);
            w.add(Calendar.DATE, 1);
        }

        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 7, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return v;
    }
}
