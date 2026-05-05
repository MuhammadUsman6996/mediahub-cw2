import io
import json
import logging
import os
from datetime import datetime, timezone

import azure.functions as func
import pyodbc
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeImageOptions, ImageData
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.ai.vision.imageanalysis.models import VisualFeatures
from azure.core.credentials import AzureKeyCredential
from azure.cosmos import CosmosClient, PartitionKey
from azure.storage.blob import BlobServiceClient, ContentSettings
from PIL import Image

app = func.FunctionApp()

# ----------------------------------------------------------------------
# Clients (created once per worker)
# ----------------------------------------------------------------------
BLOB_CONN = os.environ["BLOB_CONNECTION"]
blob_service = BlobServiceClient.from_connection_string(BLOB_CONN)

vision = ImageAnalysisClient(
    endpoint=os.environ["VISION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["VISION_KEY"]),
)

safety = ContentSafetyClient(
    endpoint=os.environ["SAFETY_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["SAFETY_KEY"]),
)

cosmos = CosmosClient(os.environ["COSMOS_ENDPOINT"], os.environ["COSMOS_KEY"])
cosmos_db = cosmos.get_database_client(os.environ["COSMOS_DB"])
cosmos_container = cosmos_db.get_container_client(os.environ["COSMOS_CONTAINER"])


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def make_thumbnail(image_bytes: bytes, max_side: int = 320) -> bytes:
    """Downscale the longest side to max_side px, JPEG output."""
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    img.thumbnail((max_side, max_side))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=82)
    return out.getvalue()


def analyse_with_vision(image_bytes: bytes) -> list[str]:
    """Return a list of detected tags."""
    result = vision.analyze(
        image_data=image_bytes,
        visual_features=[VisualFeatures.TAGS],
    )
    if not result.tags:
        return []
    # Keep only confident tags
    return [t.name for t in result.tags.list if t.confidence >= 0.6]


def moderate_with_content_safety(image_bytes: bytes) -> tuple[str, dict]:
    """Return ('approved'|'rejected', {category: severity}).
    Severity 0=safe, 2=low, 4=medium, 6=high."""
    request = AnalyzeImageOptions(image=ImageData(content=image_bytes))
    result = safety.analyze_image(request)

    scores = {item.category: item.severity for item in result.categories_analysis}
    # Reject if any category is medium or above
    status = "rejected" if any(s >= 4 for s in scores.values()) else "approved"
    return status, scores


def upsert_cosmos(media_id: str, ai_tags: list[str], safety_status: str, safety_scores: dict):
    """Update or create the metadata document for this mediaId."""
    try:
        existing = cosmos_container.read_item(item=media_id, partition_key=media_id)
    except Exception:
        existing = {"id": media_id, "mediaId": media_id, "tags": [], "stats": {"views": 0, "likes": 0}}

    existing["aiLabels"] = ai_tags
    existing["safety"] = {
        "status": safety_status,
        "scores": safety_scores,
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
    }
    cosmos_container.upsert_item(existing)


def update_sql_status(media_id: str, status: str):
    """Flip MediaItems.status in Azure SQL."""
    with pyodbc.connect(os.environ["SQL_CONN"]) as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE dbo.MediaItems SET status = ? WHERE mediaId = ?",
            status, media_id,
        )
        conn.commit()


def media_id_from_blob_name(blob_name: str) -> str:
    """media/<mediaId>.<ext>  ->  <mediaId>"""
    base = os.path.basename(blob_name)
    return os.path.splitext(base)[0]


# ----------------------------------------------------------------------
# Blob trigger - fires on uploads to the 'media' container
# ----------------------------------------------------------------------
@app.blob_trigger(
    arg_name="blob",
    path="media/{name}",
    connection="AzureWebJobsStorage",
)
def process_uploaded_media(blob: func.InputStream):
    blob_name = blob.name  # e.g. "media/abc-123.jpg"
    logging.info("Processing %s (%s bytes)", blob_name, blob.length)

    # Skip non-images for now (videos take a different pipeline)
    if not blob_name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        logging.info("Skipping non-image blob: %s", blob_name)
        return

    media_id = media_id_from_blob_name(blob_name)
    image_bytes = blob.read()

    # 1) Thumbnail -> thumbs container
    try:
        thumb_bytes = make_thumbnail(image_bytes)
        thumb_client = blob_service.get_blob_client(
            container="thumbs",
            blob=f"{media_id}.jpg",
        )
        thumb_client.upload_blob(
            thumb_bytes,
            overwrite=True,
            content_settings=ContentSettings(content_type="image/jpeg"),
        )
        logging.info("Thumbnail written for %s", media_id)
    except Exception as e:
        logging.exception("Thumbnail failed for %s: %s", media_id, e)

    # 2) AI Vision -> tags
    ai_tags: list[str] = []
    try:
        ai_tags = analyse_with_vision(image_bytes)
        logging.info("Vision tags for %s: %s", media_id, ai_tags)
    except Exception as e:
        logging.exception("Vision failed for %s: %s", media_id, e)

    # 3) Content Safety -> moderation verdict
    safety_status, safety_scores = "pending", {}
    try:
        safety_status, safety_scores = moderate_with_content_safety(image_bytes)
        logging.info("Safety for %s: %s %s", media_id, safety_status, safety_scores)
    except Exception as e:
        logging.exception("Content Safety failed for %s: %s", media_id, e)

    # 4) Persist results
    try:
        upsert_cosmos(media_id, ai_tags, safety_status, safety_scores)
    except Exception as e:
        logging.exception("Cosmos upsert failed for %s: %s", media_id, e)

    try:
        update_sql_status(media_id, safety_status)
    except Exception as e:
        logging.exception("SQL update failed for %s: %s", media_id, e)

    logging.info("Done %s -> status=%s, tags=%d", media_id, safety_status, len(ai_tags))
