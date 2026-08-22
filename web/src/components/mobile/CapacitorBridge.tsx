"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Renders nothing — only runs Capacitor's native-plugin setup, and only
 * when this page is actually loaded inside the iOS app shell (ios-app/).
 * Capacitor.isNativePlatform() is false for every normal browser tab, so
 * this is a no-op for the website itself; it exists purely because the app
 * shell points at this live site via capacitor.config.ts's server.url
 * rather than bundling its own copy, so any native-plugin calls have to be
 * made from here, not from ios-app's own (mostly unused) JS.
 */
export function CapacitorBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      // Read the actual configured background (Settings → App settings can
      // customize --color-bg away from the default) rather than hardcoding
      // it, so a custom theme's status bar still matches.
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim() || "#131211";

      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setStyle({ style: Style.Dark }); // "Dark" = light-colored (white) icons/text, for our dark bg
      await StatusBar.setBackgroundColor({ color: bg });

      const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
      await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    })();
  }, []);

  return null;
}
