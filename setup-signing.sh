#!/usr/bin/env bash
# One-time setup: creates Volapace's permanent signing key and stores it as private
# GitHub secrets, so every cloud build is signed with the same key. Passwords and
# the key are never printed. Your backup copy goes in ~/.volapace-signing, outside
# the repo. Keep it: without this key, updates can't install over the app.
set -euo pipefail

REPO="nchanjifaithful/Volapace"
DIR="$HOME/.volapace-signing"

if [ -e "$DIR/volapace.p12" ]; then
  echo "A key already exists in $DIR. Not overwriting it." >&2
  exit 1
fi

mkdir -p "$DIR"
chmod 700 "$DIR"
cd "$DIR"

openssl rand -hex 24 > keystore-password.txt
VOLAPACE_PW="$(cat keystore-password.txt)"
export VOLAPACE_PW

MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:4096 -nodes -sha256 -days 10950 \
  -keyout key.pem -out cert.pem -subj "/CN=Volapace/O=nchanjifaithful" 2>/dev/null
openssl pkcs12 -export -inkey key.pem -in cert.pem -name volapace \
  -out volapace.p12 -passout env:VOLAPACE_PW
rm -f key.pem

base64 -w0 volapace.p12 | gh secret set VOLAPACE_KEYSTORE_BASE64 --repo "$REPO"
printf '%s' "$VOLAPACE_PW" | gh secret set VOLAPACE_KEYSTORE_PASSWORD --repo "$REPO"

echo
gh secret list --repo "$REPO"
echo
openssl x509 -in cert.pem -noout -fingerprint -sha256
echo "Done. Backup saved in $DIR"
