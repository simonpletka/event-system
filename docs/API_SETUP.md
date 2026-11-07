# API setup

How to connect the two Google APIs the app uses. Both are optional: without them the app still runs, and each feature falls back as described below.

| API | Used for | Without it | Env vars |
|---|---|---|---|
| Google Routes API | Predicted-traffic drive times and route shapes on project trips | OpenStreetMap times, no traffic | `GOOGLE_MAPS_API_KEY` |
| Google Drive API | A folder per project, finance document export | No folders, exports are skipped silently | `GDRIVE_ROOT_FOLDER_ID`, `GDRIVE_OAUTH_CLIENT_ID`, `GDRIVE_OAUTH_CLIENT_SECRET`, `GDRIVE_OAUTH_REFRESH_TOKEN` |

Never paste keys into a chat, a commit or a document. They belong only in `web/.env` on your Mac (git ignores it) and in `.env` on the server. Menu names in the Google console change from time to time, so a label may differ slightly from what's written here.

## Google Routes API

**Status:** set up on the Mac. Still needs adding to the production server (steps 12–14).

**Cost:** traffic-aware routes use the Compute Routes Pro tier. See [Google's price list](https://developers.google.com/maps/billing-and-pricing/pricing).

| Monthly requests | Price |
|---|---|
| First 5,000 | Free |
| Up to 100,000 | $10 per 1,000 |
| 100,001–500,000 | $8 per 1,000 |

The app calls Google only when a trip is saved, using up to 2 requests per leg. A 4-stop trip uses about 6, so the free tier covers roughly 830 saves a month. Figures checked on 7 Nov 2026.

### In Google Cloud

1. **Sign in:** open [console.cloud.google.com](https://console.cloud.google.com) with the Google account you want to use.
2. **Create a project:** click the project picker at the top, then **New project**. Name it something like `Event system`, click **Create**, and select it.
3. **Turn on billing:** go to **Billing** in the left menu and link a billing account, adding a card if asked. This is required even if you stay in the free tier.
4. **Enable the API:** open the [Routes API page](https://console.cloud.google.com/apis/library/routes.googleapis.com), check that your project is selected, and click **Enable**. It must be the **Routes API**, not the older Directions API.
5. **Create the key:** go to **APIs & Services → Credentials**, then **Create credentials → API key**, and copy it somewhere safe for now.
6. **Restrict the key:** in the **Protect your API key** dialog (or by opening the key), choose **API restriction**, select **Routes API**, and click **Restrict key**. Don't use the Websites, Android or iOS options, because the app calls Google from the server. Don't use IP addresses either: it would block your laptop, and the server's IP can change.
7. **Set a daily limit:** go to **Google Maps Platform → Quotas** and select **Routes API**. On the row **Directions - ComputeRoutes per request quota per day**, click **⋮**, then **Edit quota**, enter **150**, and click **Submit request**. That's about 4,500 requests a month, under the 5,000 free ones, and requests stop at that limit. Leave the other rows alone.
8. **Add a budget alert (optional):** in **Billing → Budgets & alerts**, create a budget of about $1. It only emails you and doesn't stop anything.

### On your Mac

9. **Add the key:** in `web/.env`, add this line with your key, with no spaces around the `=`:

   ```sh
   GOOGLE_MAPS_API_KEY="your-key"
   ```

10. **Test it:** run this from the `web` folder.

    ```sh
    set -a; . ./.env; set +a
    curl -s https://routes.googleapis.com/directions/v2:computeRoutes \
      -H "Content-Type: application/json" \
      -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
      -H "X-Goog-FieldMask: routes.duration,routes.distanceMeters" \
      -d '{"origin":{"location":{"latLng":{"latitude":50.0771,"longitude":14.4282}}},"destination":{"location":{"latLng":{"latitude":50.0717,"longitude":14.4022}}},"travelMode":"DRIVE","routingPreference":"TRAFFIC_AWARE_OPTIMAL"}'
    ```

    A working key returns a `duration` and `distanceMeters`.

11. **Check it in the app:** restart the app, then save any trip. Legs should say **Google Maps, predicted traffic**.

### On the production server

12. **Deploy the code:** `./deploy/deploy.sh` ships the committed code of the branch you have checked out, and applies any new migrations.
13. **Add the key on the server:**

    ```sh
    ssh -i ~/.ssh/your-server-key ubuntu@your-server-ip
    sudo nano /opt/eventsystem/app/.env
    ```

    Add the same `GOOGLE_MAPS_API_KEY` line and save.

14. **Restart the app:** run `sudo systemctl restart eventsystem`.

## Google Drive API

**Status:** paused on 7 Nov 2026. The code is ready, but Drive isn't connected. Sign-in, folder creation and finance export have only run against a fake Drive client, so test them properly when you resume.

**To resume:** do steps 1–8 below on your Mac, then steps 9–12 on the server. Step 12 is what gives your real projects their folders. Also decide whether documents uploaded to a project's Files tab should be copied to its `01_DOCS` folder. They're stored on the app server for now, and nothing links the two.

**Cost:** [standard use is free](https://developers.google.com/workspace/drive/api/guides/limits). Google plans to charge above 400,000,000 quota units a day from later in 2026, far beyond this app's use.

### What it creates

The root is the `on production.` folder. Existing folders such as `docu.` aren't touched.

```text
on production.
├── EVENTS
│   └── 2026
│       └── 26-008_Winter_Product_Demo
│           ├── 01_DOCS
│           ├── 02_PROJECT
│           ├── 03_REC
│           ├── 04_PHOTO
│           └── 05_EXPORT
└── FINANCE
    ├── PRICE_QUOTES/2026        Accepted quotes (app)
    ├── SENT_INVOICES/2026       Paid invoices (app)
    ├── RECEIVED_INVOICES/2026   Expense receipts (app)
    ├── BANK_STATEMENTS          Added by hand
    ├── VAT_REPORTS              Added by hand
    ├── ANNUAL_ACCOUNTS          Added by hand
    ├── CONTRACTS                Added by hand
    └── PAYROLL                  Added by hand
```

Subfolders inherit sharing, so don't share all of `on production.` with the team. Share `EVENTS` with the team, and `FINANCE` only with whoever handles the accounting. Restrict `PAYROLL` further if needed.

- A folder is created when a project is created. The year comes from the project's start date.
- Each project page has a **Drive folder** button. Anyone opening it needs Google access to `on production.`, because the app doesn't share folders.
- A deleted project's folder stays in Drive.
- Retitling or rescheduling a project doesn't rename or move its folder.

### How the app signs in

The app acts as the personal Google account that owns `on production.`, using OAuth, and everything it creates belongs to that account and counts against its storage. Keep this in mind for large recordings in `03_REC`. A service account can't be used here: Google says service accounts ["don't have storage quota and can't own files"](https://developers.google.com/workspace/drive/api/guides/about-shareddrives) outside a Shared Drive.

If the files move to a Shared Drive later, the code already supports it: add a service account as Content manager, set `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` and remove the three `GDRIVE_OAUTH_` variables.

### In Google Cloud

Sign in as the account that owns `on production.`. Use the same project as the Routes API if that account can access it.

1. **Enable the API:** open the [Google Drive API page](https://console.cloud.google.com/apis/library/drive.googleapis.com), check that your project is selected, and click **Enable**.
2. **Set up the consent screen:** open [Google Auth Platform](https://console.cloud.google.com/auth/overview) and click **Get started**. Name it `Event system`, enter your email, and choose **External**. Then go to **Audience** and click **Publish app**. Don't leave it in Testing, because [refresh tokens then expire after 7 days](https://developers.google.com/identity/protocols/oauth2#expiration) and Drive would stop working.
3. **Create the OAuth client:** go to [Clients](https://console.cloud.google.com/auth/clients), click **Create client**, choose **Desktop app**, and name it `Event system Drive`. Keep the client ID and secret for step 5.

### In Google Drive

4. **Copy the folder ID:** open `on production.` in [Google Drive](https://drive.google.com). The ID is the part of the URL after `/folders/`.

### On your Mac

5. **Add the settings:** add these lines to `web/.env`.

   ```sh
   GDRIVE_ROOT_FOLDER_ID="your-folder-id"
   GDRIVE_OAUTH_CLIENT_ID="your-client-id"
   GDRIVE_OAUTH_CLIENT_SECRET="your-client-secret"
   ```

6. **Sign in:** run this from the `web` folder.

   ```sh
   npm run drive:auth
   ```

   Open the link it prints, in the browser where the right account is signed in, and approve. Google warns that the app is unverified: click **Advanced**, then **Go to Event system**. The script saves `GDRIVE_OAUTH_REFRESH_TOKEN` to `web/.env` without showing it.

7. **Test it:** restart the app and create a test project. Its folder should appear in Drive, and the project should show a **Drive folder** button.
8. **Create folders for existing projects:** go to **Settings → Company**, and under **Google Drive** click **Create missing folders**. This also creates `EVENTS`, `FINANCE` and all the finance folders. If it stops on an error, you can run it again and it continues.

### On the production server

9. **Deploy the code:** run `./deploy/deploy.sh`. It applies the new migration.
10. **Add the settings:** add all four `GDRIVE_` lines to `/opt/eventsystem/app/.env`, as in Routes step 13. Copy the refresh token from `web/.env`.
11. **Restart the app:** run `sudo systemctl restart eventsystem`.
12. **Create folders for production projects:** repeat step 8 on the live site. The Mac's database is separate, so this is the run that covers your real projects. Use the same root folder for both only if you're happy for demo projects to appear in it.
