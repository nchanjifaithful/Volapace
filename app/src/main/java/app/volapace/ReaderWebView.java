package app.volapace;

import android.content.Context;
import android.graphics.Rect;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.webkit.WebView;

/**
 * A WebView whose text-selection menu (Copy, Share, Select all…) also offers Highlight and Note
 * while the reader is open, so there is one menu instead of Android's and the app's competing.
 */
final class ReaderWebView extends WebView {
    private static final int ID_HIGHLIGHT = 0x7f0f0001, ID_NOTE = 0x7f0f0002;
    volatile boolean selectionTools;

    ReaderWebView(Context c) { super(c); }

    @Override public ActionMode startActionMode(ActionMode.Callback cb, int type) {
        return super.startActionMode(selectionTools ? wrap(cb) : cb, type);
    }
    @Override public ActionMode startActionMode(ActionMode.Callback cb) {
        return super.startActionMode(selectionTools ? wrap(cb) : cb);
    }

    private ActionMode.Callback wrap(ActionMode.Callback cb) {
        return new ActionMode.Callback2() {
            @Override public boolean onCreateActionMode(ActionMode mode, Menu menu) {
                boolean r = cb.onCreateActionMode(mode, menu);
                menu.add(Menu.NONE, ID_HIGHLIGHT, 0, "Highlight");
                menu.add(Menu.NONE, ID_NOTE, 1, "Note");
                return r;
            }
            @Override public boolean onPrepareActionMode(ActionMode mode, Menu menu) { return cb.onPrepareActionMode(mode, menu); }
            @Override public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
                int id = item.getItemId();
                if (id != ID_HIGHLIGHT && id != ID_NOTE) return cb.onActionItemClicked(mode, item);
                // read the selection in the page first, then close the menu
                evaluateJavascript("window.__vpSel && window.__vpSel('" + (id == ID_NOTE ? "note" : "highlight") + "')", r -> mode.finish());
                return true;
            }
            @Override public void onDestroyActionMode(ActionMode mode) { cb.onDestroyActionMode(mode); }
            @Override public void onGetContentRect(ActionMode mode, View view, Rect outRect) {
                if (cb instanceof ActionMode.Callback2) ((ActionMode.Callback2) cb).onGetContentRect(mode, view, outRect);
                else super.onGetContentRect(mode, view, outRect);
            }
        };
    }
}
