# Event System — iOS app shell

A thin native wrapper (Capacitor) around the live web app. It does **not**
bundle a copy of the site — `capacitor.config.ts`'s `server.url` points the
app's `WKWebView` straight at the Railway-hosted URL, so every screen, every
server action, and login/session all work exactly as they do in a mobile
browser tab. Nothing about how `web/` is built or deployed changes.

Good news found while scaffolding this: the installed Capacitor version
(8.x) uses **Swift Package Manager**, not CocoaPods — there's no `Podfile`,
no `pod install` step, no CocoaPods to install at all. Xcode handles the
native dependencies itself the first time you open the project.

## 1. Point it at your real site (required before building)

Edit `capacitor.config.ts` — replace the placeholder `RAILWAY_URL` with your
actual Railway production URL — then re-sync:

```bash
npm run sync
```

(`npm run sync` = `cap sync ios`, needed after any change to
`capacitor.config.ts` or after adding a plugin.)

## 2. Real branding (optional — a placeholder is already in place)

`assets/icon.png` / `assets/splash.png` are currently a generated
placeholder (dark background, the app's accent-orange dot, "EVENT SYSTEM"
wordmark) so the icon pipeline has something to work with immediately. To
use real artwork: drop a 1024×1024 PNG at `assets/icon.png` (and optionally
`assets/splash.png`, 2732×2732), then run:

```bash
npm run icons
```

This regenerates every size Xcode needs directly into
`ios/App/App/Assets.xcassets/`.

## 3. What you need to do on your Mac (none of this can be scripted)

1. **Install full Xcode** from the Mac App Store if you don't have it
   already (Command Line Tools alone aren't enough) — multi-GB download,
   needs your Apple ID. Open it once after installing so it can finish
   setting up.
2. Open the workspace — **not** the `.xcodeproj`:
   ```bash
   npm run open
   ```
   (or manually: `open ios/App/App.xcodeproj/project.xcworkspace` — Xcode
   will resolve the Swift Package dependencies automatically the first
   time, no separate install step.)
3. In Xcode, select the `App` target → **Signing & Capabilities** → pick
   your own Apple ID under Team.
   - A free personal Apple ID is enough to build and run on your own
     iPhone (re-sign every 7 days).
   - A paid Apple Developer Program membership ($99/year) is required for
     TestFlight or a public App Store listing.
4. Pick a destination (top of the Xcode window) — either an iOS Simulator
   (no device needed) or your own iPhone over USB (first time: tap "Trust
   This Computer" on the phone, and enable Developer Mode under
   Settings → Privacy & Security if prompted) — then press ▶ Run.
5. **Optional, once it's working**: if you want it installable without a
   cable long-term, set up TestFlight (internal testing only, skips App
   Review) or a full App Store Connect listing (public, goes through
   Apple's review — a pure-webview app can face extra scrutiny under
   guideline 4.2; the status-bar theming and native keyboard handling
   already wired up here are exactly the kind of "not just a bare webview"
   touches that help with that).

## What's already wired up

- `capacitor.config.ts` — `server.url` in remote mode (the "connected"
  part), `webDir: "www"` (a tiny local fallback page, only ever shown if
  the device has no network on first launch — normal operation never
  touches it).
- `@capacitor/status-bar` + `@capacitor/keyboard` — actually called from
  **inside the live web app** (`web/src/components/mobile/CapacitorBridge.tsx`,
  mounted in the root layout), not from this wrapper's own JS. That's
  because `server.url` mode means the page that's actually running is the
  real site's, not anything in `ios-app/www/` — so any native-plugin call
  has to be made from the site's own code, gated behind
  `Capacitor.isNativePlatform()` so it's a complete no-op for every normal
  browser visit.
- `web/src/app/layout.tsx` — added `viewportFit: "cover"`, which is what
  makes `env(safe-area-inset-*)` resolve to real values instead of `0`
  (needed for both the bottom tab bar's home-indicator clearance, already
  built, and the top bar's status-bar/notch clearance, added alongside
  this wrapper).
