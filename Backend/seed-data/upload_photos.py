#!/usr/bin/env python3
"""
EU-410 - Subida de las fotos del juego de datos al almacenamiento local (MinIO).

Existe porque el seed subia las fotos con el cliente de linea de comandos de AWS, y en una maquina
donde ese cliente no esta instalado el paso se saltaba con un aviso: la aplicacion quedaba con
todos los datos cargados pero sin una sola foto, y el sintoma aparecia recien al abrir un objeto.
Esto hace lo mismo hablando directo con el almacenamiento, sin depender de nada instalado.

Uso:  python Backend/seed-data/upload_photos.py <archivo-con-la-lista>
      donde cada linea del archivo es "<nombre-destino> <ruta-del-archivo-local>".
Variables: S3_ENDPOINT (default http://localhost:9000), S3_BUCKET (default eurekapp-temp),
           AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (default minioadmin / minioadmin).
"""

import datetime
import hashlib
import hmac
import os
import sys
import urllib.error
import urllib.request

ENDPOINT = os.environ.get("S3_ENDPOINT", "http://localhost:9000").rstrip("/")
BUCKET = os.environ.get("S3_BUCKET", "eurekapp-temp")
ACCESS = os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin")
SECRET = os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin")
REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
SERVICE = "s3"


def _sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(date_stamp):
    k = _sign(("AWS4" + SECRET).encode("utf-8"), date_stamp)
    k = _sign(k, REGION)
    k = _sign(k, SERVICE)
    return _sign(k, "aws4_request")


def put(key, payload):
    """PUT firmado (SigV4) de un objeto. Devuelve el codigo HTTP."""
    host = ENDPOINT.split("://", 1)[1]
    path = "/%s/%s" % (BUCKET, key)
    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(payload).hexdigest()

    canonical_headers = "host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n" % (
        host, payload_hash, amz_date)
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    canonical_request = "\n".join(
        ["PUT", path, "", canonical_headers, signed_headers, payload_hash])

    scope = "%s/%s/%s/aws4_request" % (date_stamp, REGION, SERVICE)
    to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope,
                         hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()])
    signature = hmac.new(_signing_key(date_stamp), to_sign.encode("utf-8"),
                         hashlib.sha256).hexdigest()

    authorization = ("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s"
                     % (ACCESS, scope, signed_headers, signature))
    req = urllib.request.Request(ENDPOINT + path, data=payload, method="PUT", headers={
        "Host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Authorization": authorization,
        "Content-Type": "image/jpeg",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: upload_photos.py <archivo-con-la-lista>")
    ok = bad = 0
    with open(sys.argv[1], encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            key, path = line.split(" ", 1)
            if not os.path.isfile(path):
                print("  falta el archivo %s" % path)
                bad += 1
                continue
            with open(path, "rb") as f:
                code = put(key, f.read())
            if code in (200, 204):
                ok += 1
            else:
                bad += 1
                print("  no se pudo subir %s (HTTP %s)" % (key, code))
    print("  %d fotos subidas, %d con problemas" % (ok, bad))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
