import io
import json
import base64
import os
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import qrcode
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

from app.config import settings

KEY_FILE = settings.BASE_DIR / "seva_signing_key.pem"

class Ed25519Signer:
    """
    Cryptographic authority implementing Ed25519 asymmetric signatures (RFC 8032)
    for SEVA PASS generation, anti-tamper verification, and offline-compatible QR credentials.
    
    Persistence Rules:
    1. Loads from ED25519_PRIVATE_KEY_HEX (32 bytes raw hex or PKCS8 hex) if set in environment.
    2. Loads from ED25519_PRIVATE_KEY_PEM if set in environment.
    3. Loads from seva_signing_key.pem file if present on disk.
    4. In production mode (ENVIRONMENT=production): Fails safely if no persistent key is found.
    5. In development mode: Generates a persistent key and saves to KEY_FILE.
    """
    def __init__(self):
        self._private_key: ed25519.Ed25519PrivateKey = self._load_or_generate_key()
        self._public_key: ed25519.Ed25519PublicKey = self._private_key.public_key()
        self.key_id: str = settings.KEY_ID

    def _load_or_generate_key(self) -> ed25519.Ed25519PrivateKey:
        # 1. From environment variable: ED25519_PRIVATE_KEY_HEX
        if settings.ED25519_PRIVATE_KEY_HEX:
            try:
                raw_bytes = bytes.fromhex(settings.ED25519_PRIVATE_KEY_HEX.strip())
                if len(raw_bytes) == 32:
                    return ed25519.Ed25519PrivateKey.from_private_bytes(raw_bytes)
                else:
                    return serialization.load_der_private_key(raw_bytes, password=None)  # type: ignore
            except Exception as e:
                print(f"[Crypto] Failed to load key from ED25519_PRIVATE_KEY_HEX: {e}")

        # 2. From environment variable: ED25519_PRIVATE_KEY_PEM
        if settings.ED25519_PRIVATE_KEY_PEM:
            try:
                pem_bytes = settings.ED25519_PRIVATE_KEY_PEM.encode("utf-8")
                return serialization.load_pem_private_key(pem_bytes, password=None)  # type: ignore
            except Exception as e:
                print(f"[Crypto] Failed to load key from ED25519_PRIVATE_KEY_PEM: {e}")

        # 3. From persistent file on disk
        if KEY_FILE.exists():
            try:
                pem_data = KEY_FILE.read_bytes()
                return serialization.load_pem_private_key(pem_data, password=None)  # type: ignore
            except Exception as e:
                print(f"[Crypto] Failed to load existing key file {KEY_FILE}: {e}")

        # 4. In Production: DO NOT SILENTLY REGENERATE A RANDOM KEY!
        # An ephemeral key silently invalidates all previously issued military passes on every deploy/restart.
        if settings.ENVIRONMENT.lower() == "production":
            raise RuntimeError(
                "[CRITICAL SECURITY CONFIGURATION ERROR] "
                "Ed25519 private signing key is missing in production environment. "
                "Automatic ephemeral key generation is strictly disabled in production to preserve "
                "digital signature verification and non-repudiation across deployments. "
                "Set ED25519_PRIVATE_KEY_HEX or ED25519_PRIVATE_KEY_PEM in your deployment environment."
            )

        # 5. Development Mode: Generate fresh Ed25519 private key and persist locally
        private_key = ed25519.Ed25519PrivateKey.generate()
        try:
            pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
            KEY_FILE.write_bytes(pem)
            print(f"[Crypto] Generated new local development Ed25519 private key and saved to {KEY_FILE}")
        except Exception as e:
            print(f"[Crypto] Notice: Could not persist local key file: {e}")
        return private_key

    def get_public_key_hex(self) -> str:
        raw_pub = self._public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        return raw_pub.hex()

    def get_public_key_pem(self) -> str:
        pem = self._public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return pem.decode("utf-8")

    def export_private_key_raw_hex(self) -> str:
        """Helper for administrative provisioning of deployment environment variables."""
        raw_priv = self._private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        return raw_priv.hex()

    def canonicalize_payload(self, data: Dict[str, Any]) -> str:
        """
        Deterministic canonical serialization:
        - Sorted keys
        - Compact JSON without arbitrary whitespace
        - Guarantees byte-for-byte reproducibility across environments
        """
        return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

    def sign_payload(self, data: Dict[str, Any]) -> Tuple[str, str]:
        """
        Signs canonical JSON representation of payload.
        Returns: (canonical_json_string, signature_hex)
        """
        canonical_json = self.canonicalize_payload(data)
        signature_bytes = self._private_key.sign(canonical_json.encode('utf-8'))
        return canonical_json, signature_bytes.hex()

    def verify_payload_signature(self, canonical_json: str, signature_hex: str) -> bool:
        """
        Verifies Ed25519 signature against public key.
        """
        try:
            sig_bytes = bytes.fromhex(signature_hex)
            self._public_key.verify(sig_bytes, canonical_json.encode('utf-8'))
            return True
        except (InvalidSignature, ValueError, TypeError):
            return False

    def build_qr_credential(self, pass_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds the structured verifiable QR credential payload.
        """
        verifiable_fields = {
            "pass_code": pass_data["pass_code"],
            "vehicle_reg": pass_data["vehicle_registration_number"],
            "dept_code": pass_data.get("department_code", ""),
            "origin": pass_data["journey_origin"],
            "destination": pass_data["journey_destination"],
            "valid_from": pass_data["valid_from"],
            "valid_until": pass_data["valid_until"],
            "legal_basis": pass_data.get("eligibility_basis", "Section 3(1)(a) Tolls Act 1901")
        }
        
        canonical_json, signature_hex = self.sign_payload(verifiable_fields)
        
        credential = {
            "version": "2.0",
            "issuer": "SEVA PASS Digital Authority",
            "key_id": self.key_id,
            "pass_code": pass_data["pass_code"],
            "payload": verifiable_fields,
            "signature": signature_hex,
            "canonical": canonical_json
        }
        return credential

    def compact_qr_payload(self, qr_content: str) -> str:
        """
        Compresses a full SEVA PASS JSON credential into a minimal compact format
        ({"p": pass_code, "k": key_id, "s": base64url_signature}) so the generated QR
        code has large, low-density modules that cameras grasp rapidly.
        """
        try:
            parsed = json.loads(qr_content)
            if isinstance(parsed, dict) and "signature" in parsed and ("pass_code" in parsed or "payload" in parsed):
                pass_code = parsed.get("pass_code") or parsed.get("payload", {}).get("pass_code")
                key_id = parsed.get("key_id", self.key_id)
                sig_hex = parsed["signature"]
                sig_b64 = base64.urlsafe_b64encode(bytes.fromhex(sig_hex)).decode("ascii").rstrip("=")
                return json.dumps({"p": pass_code, "k": key_id, "s": sig_b64}, separators=(",", ":"))
        except Exception:
            pass
        return qr_content

    def generate_qr_data_url(self, qr_content: str) -> str:
        """
        Encodes compact credential content as a crisp PNG QR code with high error
        correction (H) and a centered SEVA PASS shield emblem, returned as a data URL.
        """
        from PIL import Image, ImageDraw

        compact_content = self.compact_qr_payload(qr_content)

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(compact_content)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#14243A", back_color="#FFFFFF").convert("RGBA")

        # Draw centered SEVA PASS shield logo (~18% of QR width; safe under ERROR_CORRECT_H 30%)
        w, h = img.size
        badge_size = max(36, int(w * 0.18))
        pad = max(6, int(badge_size * 0.14))
        total_box = badge_size + pad * 2
        bx0 = (w - total_box) // 2
        by0 = (h - total_box) // 2

        draw = ImageDraw.Draw(img)
        # White quiet pad around center logo
        draw.rounded_rectangle(
            [bx0, by0, bx0 + total_box, by0 + total_box],
            radius=max(6, total_box // 6),
            fill="#FFFFFF",
        )
        # Navy badge with gold border
        lx0, ly0 = bx0 + pad, by0 + pad
        lx1, ly1 = lx0 + badge_size, ly0 + badge_size
        draw.rounded_rectangle(
            [lx0, ly0, lx1, ly1],
            radius=max(4, badge_size // 6),
            fill="#14243A",
            outline="#B99A62",
            width=max(2, badge_size // 18),
        )
        # Centered gold shield polygon inside badge
        cx, cy = (lx0 + lx1) / 2, (ly0 + ly1) / 2
        sw, sh = badge_size * 0.46, badge_size * 0.56
        shield_pts = [
            (cx, cy - sh * 0.52),
            (cx + sw * 0.52, cy - sh * 0.30),
            (cx + sw * 0.44, cy + sh * 0.16),
            (cx, cy + sh * 0.54),
            (cx - sw * 0.44, cy + sh * 0.16),
            (cx - sw * 0.52, cy - sh * 0.30),
        ]
        draw.polygon(shield_pts, fill="#B99A62")
        # Crisp navy checkmark inside shield
        tick_w = max(2, int(badge_size * 0.08))
        draw.line(
            [
                (cx - sw * 0.22, cy + sh * 0.02),
                (cx - sw * 0.04, cy + sh * 0.20),
                (cx + sw * 0.24, cy - sh * 0.14),
            ],
            fill="#14243A",
            width=tick_w,
        )

        buffer = io.BytesIO()
        img.convert("RGB").save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"

signer = Ed25519Signer()

if __name__ == "__main__":
    print("SEVA PASS Cryptographic Authority Information:")
    print("Algorithm:          Ed25519 (RFC 8032)")
    print("Key ID:             " + signer.key_id)
    print("Public Key (Hex):   " + signer.get_public_key_hex())
    print("Private Key (Hex):  " + signer.export_private_key_raw_hex())
