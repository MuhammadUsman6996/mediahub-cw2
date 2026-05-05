// MediaHub API client - wraps the four Logic App endpoints
// Used by browse.html, upload.html, detail.html

const cfg = window.MEDIAHUB_CONFIG;

const api = {
  // POST /media -> { mediaId, blobUrl, uploadUrl, expiresIn, status }
  async createMedia({ ownerId, title, fileExtension, visibility }) {
    const r = await fetch(cfg.CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId, title, fileExtension, visibility })
    });
    if (!r.ok) throw new Error(`Create failed: ${r.status}`);
    return r.json();
  },

  // PUT a file directly to blob storage using the SAS upload URL
  async uploadFileToSas(uploadUrl, file) {
    const r = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });
    if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
  },

  // GET /media -> array of MediaItems
  async listMedia() {
    const r = await fetch(cfg.READ_URL + "/" + cfg.READ_URL_QUERY);
    if (!r.ok) throw new Error(`List failed: ${r.status}`);
    return r.json();
  },

  // GET /media/{id} -> { mediaItem, metadata }
  async getMedia(mediaId) {
    const r = await fetch(cfg.READ_URL + "/" + encodeURIComponent(mediaId) + cfg.READ_URL_QUERY);
    if (!r.ok) throw new Error(`Get failed: ${r.status}`);
    return r.json();
  },

  // PUT /media/{id}
  async updateMedia(mediaId, patch) {
    const r = await fetch(cfg.UPDATE_URL + "/" + encodeURIComponent(mediaId) + cfg.UPDATE_URL_QUERY, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (!r.ok) throw new Error(`Update failed: ${r.status}`);
    return r.json();
  },

  // DELETE /media/{id}
  async deleteMedia(mediaId) {
    const r = await fetch(cfg.DELETE_URL + "/" + encodeURIComponent(mediaId) + cfg.DELETE_URL_QUERY, {
      method: "DELETE"
    });
    if (!r.ok && r.status !== 204) throw new Error(`Delete failed: ${r.status}`);
  }
};

// Helpers used by all pages
function thumbUrl(mediaId) {
  return `https://${cfg.STORAGE_ACCOUNT}.blob.core.windows.net/thumbs/${mediaId}.jpg`;
}

function statusPill(status) {
  const s = (status || "pending").toLowerCase();
  return `<span class="pill ${s}">${s}</span>`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
