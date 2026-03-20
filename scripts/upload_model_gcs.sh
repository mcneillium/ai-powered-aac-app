#!/usr/bin/env bash
# Upload trained model artifacts to Google Cloud Storage.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCS bucket created (see MANUAL ACTIONS in README)
#
# Usage:
#   ./scripts/upload_model_gcs.sh [BUCKET_NAME] [MODEL_DIR]
#
# Example:
#   ./scripts/upload_model_gcs.sh commai-models assets/tf_model/word_prediction_tfjs

set -euo pipefail

BUCKET="${1:-commai-models}"
MODEL_DIR="${2:-assets/tf_model/word_prediction_tfjs}"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="gs://${BUCKET}/models/word_prediction/${TIMESTAMP}/"
LATEST="gs://${BUCKET}/models/word_prediction/latest/"

if [ ! -d "$MODEL_DIR" ]; then
  echo "Error: Model directory not found: $MODEL_DIR"
  echo "Run 'python train_aac_model.py' first."
  exit 1
fi

echo "Uploading model artifacts from ${MODEL_DIR} to ${DEST}..."
gsutil -m cp -r "${MODEL_DIR}/"* "${DEST}"

echo "Updating latest pointer at ${LATEST}..."
gsutil -m cp -r "${MODEL_DIR}/"* "${LATEST}"

echo "Done. Model uploaded as ${TIMESTAMP} and latest."
echo ""
echo "Files uploaded:"
gsutil ls "${DEST}"
