// MediaHub frontend config
// Replace these with the trigger URLs from your four Logic Apps.
// Get them from: Azure Portal -> Logic App -> Overview -> "Workflow URL"

window.MEDIAHUB_CONFIG = {
  // POST /media - returns { mediaId, uploadUrl, ... }
  CREATE_URL: "https://prod-XX.uksouth.logic.azure.com/workflows/<id>/triggers/manual/paths/invoke?api-version=2016-10-01&sp=...&sv=...&sig=...",

  // GET /media (list) and /media/{id} (one)
  // Note: the {mediaId} segment is appended in code
  READ_URL: "https://prod-XX.uksouth.logic.azure.com/workflows/<id>/triggers/manual/paths/invoke",
  READ_URL_QUERY: "?api-version=2016-10-01&sp=...&sv=...&sig=...",

  // PUT /media/{id}
  UPDATE_URL: "https://prod-XX.uksouth.logic.azure.com/workflows/<id>/triggers/manual/paths/invoke",
  UPDATE_URL_QUERY: "?api-version=2016-10-01&sp=...&sv=...&sig=...",

  // DELETE /media/{id}
  DELETE_URL: "https://prod-XX.uksouth.logic.azure.com/workflows/<id>/triggers/manual/paths/invoke",
  DELETE_URL_QUERY: "?api-version=2016-10-01&sp=...&sv=...&sig=...",

  // For demo: hard-code an ownerId from dbo.Users (the seed creator userId).
  // Replace with the actual UUID from your seeded Users table.
  // SELECT userId FROM dbo.Users WHERE email = 'creator@mediahub.demo';
  DEFAULT_OWNER_ID: "00000000-0000-0000-0000-000000000000",

  // Storage account name (for thumbnail URLs from the thumbs/ container)
  STORAGE_ACCOUNT: "<your-storage-account>"
};
