"""
Encrypts Google OAuth tokens before they touch the database. Fernet (AES-128-CBC +
HMAC) is sufficient here: the key lives only in the server's environment, never in
the database, never in a response to the frontend or mobile app.
"""

from cryptography.fernet import Fernet, InvalidToken

from ..config import get_settings


def _fernet() -> Fernet:
    settings = get_settings()
    key = settings.token_encryption_key
    if not key:
        raise RuntimeError(
            "TOKEN_ENCRYPTION_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode())


def encrypt_token(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Stored Google token could not be decrypted") from exc
