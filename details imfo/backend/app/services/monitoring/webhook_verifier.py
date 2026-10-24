import hashlib
import hmac
import os
from typing import Optional


class WebhookVerifier:
    """
    Cryptographic verification service for GitHub webhooks.
    Validates X-Hub-Signature-256 using HMAC-SHA256 and constant-time string comparison.
    """

    def __init__(self, secret: Optional[str] = None):
        self._secret = secret

    @property
    def secret(self) -> str:
        if self._secret:
            return self._secret
        return os.getenv("GITHUB_WEBHOOK_SECRET", "codelens_dev_webhook_secret_key")

    def verify_signature(self, raw_payload: bytes, signature_header: Optional[str]) -> bool:
        """
        Verifies the HMAC-SHA256 signature from GitHub.
        Uses hmac.compare_digest for constant-time comparison to prevent timing attacks.
        """
        if not signature_header or not signature_header.startswith("sha256="):
            return False

        secret_bytes = self.secret.encode("utf-8")
        computed_digest = hmac.new(
            secret_bytes,
            raw_payload,
            hashlib.sha256
        ).hexdigest()

        expected_signature = f"sha256={computed_digest}"
        return hmac.compare_digest(expected_signature, signature_header)

    def generate_signature(self, raw_payload: bytes, secret: Optional[str] = None) -> str:
        """
        Generates a valid X-Hub-Signature-256 header value for testing or outbound hooks.
        """
        sec = secret or self.secret
        computed_digest = hmac.new(
            sec.encode("utf-8"),
            raw_payload,
            hashlib.sha256
        ).hexdigest()
        return f"sha256={computed_digest}"
