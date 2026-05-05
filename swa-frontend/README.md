# MediaHub Static Web App frontend

Three pages, vanilla HTML/CSS/JS. Wired to the four Logic App endpoints.

```
swa-frontend/
├── index.html               Browse - grid of all media
├── upload.html              Upload - 3-step flow with status polling
├── detail.html              Detail - player, edit, delete
├── style.css                Shared dark theme
├── app.js                   API client (the four CRUD calls)
├── config.js                Endpoint URLs (edit this!)
└── staticwebapp.config.json SWA fallback routing
```

## Step 1 - Configure endpoints

Open `config.js` and replace:

- `CREATE_URL`, `READ_URL`, `UPDATE_URL`, `DELETE_URL` (and their `_QUERY` parts)
  with the trigger URLs from your four Logic Apps. The trigger URL has two
  parts: the path before `?` and the query string after - this code splits them
  so we can append `/{mediaId}` for the read/update/delete workflows.
- `DEFAULT_OWNER_ID` with a real userId from your `dbo.Users` table:
  ```sql
  SELECT userId FROM dbo.Users WHERE email = 'creator@mediahub.demo';
  ```
- `STORAGE_ACCOUNT` with your storage account name (used to build thumbnail URLs).

### How to split the Logic App URL

A Logic App trigger URL looks like:
```
https://prod-XX.uksouth.logic.azure.com/workflows/abc/triggers/manual/paths/invoke?api-version=2016-10-01&sp=...&sig=...
```

Split it at the `?`:
- Everything before `?` -> `READ_URL`
- The `?` and everything after -> `READ_URL_QUERY`

This lets the code build URLs like `READ_URL + "/" + mediaId + READ_URL_QUERY`.

## Step 2 - Enable CORS on Logic Apps

Each Logic App needs to accept calls from the Static Web App's origin.

Portal -> each Logic App -> **CORS** (under Settings) -> add:
- `https://<your-swa-name>.azurestaticapps.net`
- `http://localhost:4280` (for `swa start` local testing)

Or use `*` for the demo (mention you'd lock this down in production).

## Step 3 - Make blob containers readable for thumbnails

The browse grid loads thumbnail URLs directly from `thumbs/`. Either:

- Set the **thumbs** container access level to "Blob (anonymous read access for blobs only)", OR
- Configure the blob service CORS rule to allow GET from your SWA origin
  (Portal -> Storage account -> **Resource sharing (CORS)** -> Blob service)

Same applies to **media** if you want full-size images to render directly
in `detail.html`. For private media, you'd extend the read Logic App to
return a short-lived read SAS - mention this as future work in the video.

## Step 4 - Deploy

### Option A: SWA CLI (fastest for testing)

```bash
npm install -g @azure/static-web-apps-cli
cd swa-frontend
swa deploy . --deployment-token <token from Portal -> SWA -> Manage deployment token>
```

### Option B: GitHub Actions (the proper CI/CD path)

1. Push this folder to a GitHub repo (root or subfolder)
2. Portal -> Create -> Static Web App -> connect to GitHub repo
3. Set **App location** = `/swa-frontend` (or `/` if at repo root)
4. Set **API location** = (leave empty)
5. Set **Output location** = (leave empty - this is plain static)

Azure auto-generates a `.github/workflows/azure-static-web-apps-*.yml`
file in your repo. Every push to main triggers a deploy.

## Local testing

```bash
cd swa-frontend
npx @azure/static-web-apps-cli start .
# opens http://localhost:4280
```

## Demo flow for the video (~90 seconds)

1. Open Browse. Show existing items in the grid (seeded from SQL).
2. Click Upload. Type a title, pick an image, click Upload.
   - Status box shows the three steps live.
   - Step 3 ("Waiting for AI pipeline") is the moment to mention
     that the Function App's blob trigger is now running Vision +
     Content Safety in the background.
3. Page redirects to detail. Show:
   - Image plays
   - **Auto tags from AI Vision** appear in the sidebar - this is the
     advanced feature mark
   - Status pill is now "approved" or "rejected"
4. Click Edit. Change title. Show it persists.
5. Click Delete. Confirm. Item disappears from Browse.

That single flow demonstrates all four CRUD verbs end-to-end and shows
the advanced AI features actually working.

## Things worth knowing

- **No framework, no build.** Pure files. SWA serves them as-is. Easy
  to debug live in the video using browser devtools.
- **`<dialog>` element** is used for the edit modal - native, no library.
- **Polling, not webhooks.** Simpler and no extra Azure resources. The
  upload page polls every 2 seconds for up to 60 seconds.
- **Thumbnail fallback.** If `thumbs/{id}.jpg` doesn't exist yet (e.g.
  for the seeded items), the card just shows the dark placeholder - no
  broken-image icon - because we use `background-image` (which silently
  fails to load).
