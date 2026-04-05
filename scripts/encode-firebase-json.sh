#!/usr/bin/env bash
# Usage: ./scripts/encode-firebase-json.sh path/to/serviceAccountKey.json
# Copier la sortie dans Railway → FIREBASE_SERVICE_ACCOUNT_BASE64
set -euo pipefail
if [[ -z "${1:-}" ]] || [[ ! -f "$1" ]]; then
  echo "Usage: $0 <serviceAccountKey.json>" >&2
  exit 1
fi
base64 < "$1" | tr -d '\n'
echo
