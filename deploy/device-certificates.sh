#!/usr/bin/env bash
# Geräte-CA und je Gerät ein Zertifikat. PRIVATE KEYS nie in Git.
set -eo pipefail
umask 077
CA_DIR=/etc/nginx/kalender
OUT_DIR=/root/kalender-device-certificates
mkdir -p "$CA_DIR" "$OUT_DIR"
chmod 700 "$CA_DIR" "$OUT_DIR"
COMMAND="$1"
if [[ "$COMMAND" == "init-ca" ]]; then
  if [[ -e "$CA_DIR/client-ca.key" ]]; then
    echo "STOP: Geräte-CA existiert schon. Kein Überschreiben." >&2
    exit 1
  fi
  openssl req -new -newkey rsa:4096 -nodes -x509 -sha256 -days 3650 \
    -subj "/CN=Bytevo Kalender Private Device CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -keyout "$CA_DIR/client-ca.key" -out "$CA_DIR/client-ca.crt"
  chmod 600 "$CA_DIR/client-ca.key"
  chmod 644 "$CA_DIR/client-ca.crt"
  echo "Geräte-CA eingerichtet."
  exit 0
fi
if [[ "$COMMAND" == "issue" ]]; then
  if [[ ! -f "$CA_DIR/client-ca.key" ]]; then echo "Zuerst init-ca ausführen." >&2; exit 1; fi
  DEVICE="$2"
  if [[ ! "$DEVICE" =~ ^[a-zA-Z0-9_-]{2,40}$ ]]; then echo "Name z.B. pc oder iphone" >&2; exit 1; fi
  if [[ -e "$OUT_DIR/$DEVICE.p12" || -e "$OUT_DIR/$DEVICE.key" ]]; then
    echo "STOP: Zertifikat existiert. Kein Überschreiben." >&2
    exit 1
  fi
  openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
    -subj "/CN=Kalender Device $DEVICE" \
    -keyout "$OUT_DIR/$DEVICE.key" -out "$OUT_DIR/$DEVICE.csr"
  cat > "$OUT_DIR/$DEVICE.ext" <<'EOT'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=clientAuth
EOT
  openssl x509 -req -in "$OUT_DIR/$DEVICE.csr" \
    -CA "$CA_DIR/client-ca.crt" -CAkey "$CA_DIR/client-ca.key" \
    -CAcreateserial -days 365 -sha256 -extfile "$OUT_DIR/$DEVICE.ext" \
    -out "$OUT_DIR/$DEVICE.crt"
  echo "Einmaliges Export-Passwort schützt die .p12-Datei beim Übertragen."
  openssl pkcs12 -export -out "$OUT_DIR/$DEVICE.p12" \
    -inkey "$OUT_DIR/$DEVICE.key" -in "$OUT_DIR/$DEVICE.crt" \
    -certfile "$CA_DIR/client-ca.crt" -name "Bytevo Kalender $DEVICE"
  chmod 600 "$OUT_DIR/$DEVICE."*
  rm -f "$OUT_DIR/$DEVICE.csr" "$OUT_DIR/$DEVICE.ext"
  echo "Fertig: $OUT_DIR/$DEVICE.p12"
  exit 0
fi
echo "Aufruf: bash $0 init-ca oder bash $0 issue pc" >&2
exit 2
