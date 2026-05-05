# MediaHub - COM682 CW2 starter bundle

Muhammad Usman (10423177) - Cloud Native Development

This bundle contains the first two pieces of the CW2 implementation for the
MediaHub design from CW1:

```
mediahub/
├── sql/
│   └── 01_schema.sql              Azure SQL schema + seed data
├── mediahub-functions/            Function App: blob trigger + Vision + Content Safety
├── logic-apps/                    Four Consumption Logic Apps for CRUD
└── swa-frontend/                  Static Web App frontend (3 pages)
```

## 1. SQL schema

Run `sql/01_schema.sql` in Azure SQL via Portal -> Query editor (preview).
Creates four tables (Users, MediaItems, Comments, Favourites) matching the
CW1 ERD, with indexes, check constraints, cascade rules, and seed data.

If the editor fails to connect: SQL Server -> Networking -> "Add my IP".

## 2. Function App

The blob trigger fires when a file lands in the `media/` container. It:

1. Generates a 320px JPEG thumbnail and writes it to `thumbs/`
2. Calls Azure AI Vision to auto-tag the image
3. Calls Azure AI Content Safety to get moderation severities
4. Upserts the metadata document in Cosmos DB
5. Updates `MediaItems.status` in Azure SQL (approved / rejected)

### Naming convention (important)

When uploading, the blob name MUST be `<mediaId>.<ext>` where `<mediaId>` is
the same UNIQUEIDENTIFIER you inserted into `dbo.MediaItems`. This is the
single key tying SQL row -> Cosmos doc -> blob -> thumbnail.

### Azure resources you need to create first

- Storage account with containers `media` (private) and `thumbs` (private)
- Azure AI Vision (Cognitive Services) - get endpoint + key
- Azure AI Content Safety - get endpoint + key
- Cosmos DB account, database `mediahub`, container `MediaMetadata`
  (partition key `/mediaId`)
- Function App (Linux, Python 3.11, Consumption plan), tick App Insights
- Azure SQL Database (where you ran the schema)

### Deploy

```bash
cd mediahub-functions
func azure functionapp publish <your-function-app-name>
```

Then in Portal -> Function App -> Configuration -> Application settings,
add every key from `local.settings.json` (except the `IsEncrypted` /
`Values` wrapper). For extra credit, store the secrets in Key Vault and
reference them with:

    @Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/<name>/)

### `pyodbc` note

Linux Consumption Function Apps on Python 3.11 ship the ODBC driver
pre-installed. If you hit a `libodbc` error at runtime, swap to `pymssql`
in `requirements.txt` and adjust the connect call in
`update_sql_status()` accordingly.

## Next pieces still to build

- GitHub Actions CI/CD (auto-deploy Function App + SWA on push)
- 5-min Panopto video script
