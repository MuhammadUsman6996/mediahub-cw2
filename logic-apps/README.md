# Logic Apps CRUD - Deployment Guide

Four Consumption Logic Apps providing the public REST API for MediaHub.

```
logic-apps/
├── lapp-mediahub-create.json    POST   /media           -> SAS upload URL
├── lapp-mediahub-read.json      GET    /media[/{id}]    -> list or one
├── lapp-mediahub-update.json    PUT    /media/{id}      -> patch metadata
└── lapp-mediahub-delete.json    DELETE /media/{id}      -> tear down everything
```

## Before you start

You need three API Connections in the same resource group. Create them
once and the workflows reuse them:

| Connection name in JSON | What to create | Connector display name |
|---|---|---|
| `sql`         | Azure SQL connection to your `mediahub` DB        | "SQL Server" |
| `documentdb`  | Cosmos DB (Core SQL) connection                   | "Azure Cosmos DB" |
| `azureblob`   | Storage account connection (your media storage)   | "Azure Blob Storage" |

Easiest way to create them: in the Logic Apps designer, drop in any SQL /
Cosmos / Blob action once and let the wizard prompt for credentials. The
connection then becomes reusable across all four workflows.

## Per workflow - import steps

For each of the four files:

1. Azure Portal -> Create resource -> "Logic App" -> **Consumption**
2. Resource group: `rg-mediahub` | Name: e.g. `lapp-mediahub-create`
3. Once provisioned, open it -> **Logic app code view**
4. Paste the contents of the matching JSON file
5. **Save**
6. Open the Logic Apps designer once - it will prompt you to bind the
   `sql`, `documentdb`, and `azureblob` connections. Pick the
   connections you created above.

## Important placeholder to replace

In `lapp-mediahub-create.json`, find this line and swap in your actual
storage account name:

    "value": "@{concat('https://<STORAGE_ACCOUNT>.blob.core.windows.net/media/', variables('blobName'))}"

The `AccountNameFromSettings` literal in the create + delete workflows
is **NOT** a placeholder - it's the real string the Blob connector uses
to refer to the connected account. Leave it as is.

## Getting the trigger URLs

After saving each workflow, open it -> **Overview** -> the HTTP POST/GET/PUT/DELETE
URL is shown at the top. It looks like:

    https://prod-xx.uksouth.logic.azure.com/workflows/<id>/triggers/<name>/paths/invoke?api-version=2016-10-01&sp=...&sv=...&sig=...

Copy these four URLs. The frontend calls them. The `sig` query
parameter is the SAS signature - it's the auth, so don't strip it.

## How the frontend uses these endpoints

```javascript
// 1. Ask for an upload slot
const created = await fetch(CREATE_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ownerId: "<a real userId from dbo.Users>",
    title: "Sunset over Belfast",
    fileExtension: "jpg",
    visibility: "public"
  })
}).then(r => r.json());

// created = { mediaId, blobUrl, uploadUrl, expiresIn, status }

// 2. PUT the file directly to blob storage using the SAS URL
await fetch(created.uploadUrl, {
  method: "PUT",
  headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type },
  body: file
});

// 3. The blob trigger Function App now wakes up,
//    runs Vision + Content Safety, updates Cosmos
//    and flips MediaItems.status from 'pending' to 'approved' or 'rejected'.

// 4. List media
const list = await fetch(READ_URL.replace('/{mediaId}', ''))
                     .then(r => r.json());

// 5. Update title
await fetch(UPDATE_URL.replace('{mediaId}', created.mediaId), {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Sunset over Belfast (edited)" })
});

// 6. Delete
await fetch(DELETE_URL.replace('{mediaId}', created.mediaId), {
  method: "DELETE"
});
```

## Why one workflow per HTTP verb

Each workflow gets its own Run history page in the portal. During
the demo video you walk through four named workflows showing four
distinct Run histories, which is much more visible than one workflow
with a switch case.

## Things worth knowing for the video

- The CREATE workflow does NOT receive the file bytes. It returns
  a SAS URL the frontend uses to PUT the file directly into blob storage.
  This is the correct cloud-native pattern - Logic Apps never
  touches the binary, avoiding the workflow payload limits.
- The DELETE workflow tolerates partial failures by design (the
  `runAfter` accepts both `Succeeded` and `Failed`) so a missing
  thumbnail doesn't block deleting the SQL row.
- Updating Cosmos with `PUT` on `/docs/{id}` is an upsert. We read first
  so we preserve fields the frontend didn't send (aiLabels, stats, safety).

## Smoke test from the terminal

```bash
# Create
curl -sS -X POST "$CREATE_URL" \
  -H "Content-Type: application/json" \
  -d '{"ownerId":"<userId>","title":"Test","fileExtension":"jpg"}'

# List
curl -sS "$READ_URL_NO_ID"

# Get one
curl -sS "$READ_URL_WITH_ID/<mediaId>"

# Update
curl -sS -X PUT "$UPDATE_URL/<mediaId>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Renamed"}'

# Delete
curl -sS -X DELETE "$DELETE_URL/<mediaId>"
```
