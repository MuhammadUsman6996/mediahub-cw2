const cfg = window.MEDIAHUB_CONFIG;

const api = {
  async createMedia({ ownerId, title, fileExtension, visibility }) {
    const r = await fetch(cfg.CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId, title, fileExtension, visibility })
    });
    if (!r.ok) throw new Error(`Create failed: ${r.status}`);
    return r.json();
  },

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

  async listMedia() {
    const r = await fetch(cfg.READ_LIST_URL);
    if (!r.ok) throw new Error(`List failed: ${r.status}`);
    return r.json();
  },

  async getMedia(mediaId) {
    const url = cfg.READ_ONE_URL + "&mediaId=" + encodeURIComponent(mediaId);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Get failed: ${r.status}`);
    return r.json();
  },
  async updateMedia(mediaId, patch) {
    const url = cfg.UPDATE_URL.replace("%7BmediaId%7D", encodeURIComponent(mediaId));
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (!r.ok) throw new Error(`Update failed: ${r.status}`);
    return r.json();
  },

  async deleteMedia(mediaId) {
    const url = cfg.DELETE_URL.replace("%7BmediaId%7D", encodeURIComponent(mediaId));
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(`Delete failed: ${r.status}`);
  }
};
function thumbUrl(mediaId, blobUrl) {
  const sas = "se=2026-12-31&sp=rl&sv=2026-02-06&sr=c&sig=HSWlaudSpchXk90zzvk2GuknJPZ49KJyJJopTq6xSdc%3D";
  if (blobUrl) return blobUrl + "?" + sas;
  return "https://mediahubstorage1.blob.core.windows.net/media/" + mediaId + ".jpg?" + sas;
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