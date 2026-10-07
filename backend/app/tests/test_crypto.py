import pytest
from cryptography.fernet import Fernet

from app.services import crypto


def test_round_trip():
    original = "ya29.fake-access-token-value"
    encrypted = crypto.encrypt_token(original)

    assert original not in encrypted
    assert crypto.decrypt_token(encrypted) == original


def test_ciphertext_differs_each_time():
    """Fernet includes a random IV, so encrypting the same token twice must not match —
    otherwise two organizations with the same token would be distinguishable by ciphertext."""
    a = crypto.encrypt_token("same-token")
    b = crypto.encrypt_token("same-token")
    assert a != b


def test_tampered_ciphertext_does_not_decrypt():
    encrypted = crypto.encrypt_token("a-refresh-token")
    tampered = encrypted[:-4] + ("A" * 4)
    with pytest.raises(ValueError):
        crypto.decrypt_token(tampered)


def test_wrong_key_cannot_decrypt(monkeypatch):
    encrypted = crypto.encrypt_token("secret")

    other_key = Fernet.generate_key().decode()
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", other_key)

    with pytest.raises(ValueError):
        crypto.decrypt_token(encrypted)
