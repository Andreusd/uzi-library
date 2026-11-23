import os
import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

_fernet_instance: Optional[Fernet] = None

def _get_fernet_key() -> bytes:
    machine_id = b""
    for mid_path in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        if os.path.isfile(mid_path):
            try:
                with open(mid_path, "rb") as f:
                    machine_id = f.read().strip()
                    if machine_id:
                        break
            except Exception:
                pass

    if not machine_id:
        import socket
        machine_id = socket.gethostname().encode("utf-8")

    key_dir = os.path.expanduser("~/.config/uzilibrary")
    key_file = os.path.join(key_dir, ".master_key")

    try:
        os.makedirs(key_dir, mode=0o700, exist_ok=True)
    except Exception:
        pass

    secret_bytes = b""
    if os.path.isfile(key_file):
        try:
            with open(key_file, "rb") as f:
                secret_bytes = f.read()
        except Exception:
            pass

    if len(secret_bytes) < 32:
        import secrets
        secret_bytes = secrets.token_bytes(32)
        try:
            flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
            fd = os.open(key_file, flags, 0o600)
            with os.fdopen(fd, "wb") as f:
                f.write(secret_bytes)
        except Exception:
            pass

    derived = hashlib.sha256(machine_id + b"::uzilibrary::" + secret_bytes).digest()
    return base64.urlsafe_b64encode(derived)

def get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        _fernet_instance = Fernet(_get_fernet_key())
    return _fernet_instance

def encrypt_secret(val: str) -> str:
    """Encrypts plaintext secret returning an armored enc:v1:<fernet_token> string."""
    if not val or not val.strip():
        return ""
    f = get_fernet()
    token = f.encrypt(val.strip().encode("utf-8")).decode("ascii")
    return f"enc:v1:{token}"

def decrypt_secret(val: str) -> str:
    """Decrypts an enc:v1:<token> string. Falls back gracefully to plaintext for legacy values."""
    if not val:
        return ""
    val_str = str(val).strip()
    if not val_str.startswith("enc:v1:"):
        return val_str  # legacy unencrypted plaintext fallback
    token = val_str[7:]
    try:
        f = get_fernet()
        return f.decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, Exception):
        return ""
