import type { CapacitorConfig } from "@capacitor/cli";

const RAILWAY_URL = "https://event-system-production-43fc.up.railway.app";

const config: CapacitorConfig = {
  appId: "cz.eventsystem.app",
  appName: "Event System",
  webDir: "www",
  server: {
    // Pointing at the live, hosted app instead of bundling static files is
    // what makes this a "connected" app — every screen, every server
    // action, every auth check runs exactly as it does in a browser tab,
    // no separate API or offline copy to keep in sync.
    url: RAILWAY_URL,
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
