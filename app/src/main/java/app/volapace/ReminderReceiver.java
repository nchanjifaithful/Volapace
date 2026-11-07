package app.volapace;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** An alarm went off: post the reminder (if today isn't done) and schedule the next one. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        Reminders.fire(c, i.getIntExtra("which", Reminders.DAILY));
    }
}
