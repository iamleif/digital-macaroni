"""
Twilio request signatures and TwiML. X-Twilio-Signature is HMAC-SHA1 with the account auth token
over the exact public URL followed by each POST parameter name and value, sorted by name, base64.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Optional
from xml.sax.saxutils import quoteattr


def twilio_signature(auth_token: str, url: str, params: dict[str, str]) -> str:
    data = url + "".join(k + params[k] for k in sorted(params))
    return base64.b64encode(hmac.new(auth_token.encode(), data.encode(), hashlib.sha1).digest()).decode()


def valid_twilio_signature(auth_token: str, url: str, params: dict[str, str], signature: Optional[str]) -> bool:
    if not auth_token or not signature:
        return False
    return hmac.compare_digest(twilio_signature(auth_token, url, params), signature)


def valid_media_signature(auth_token: str, public_url: str, signature: Optional[str]) -> bool:
    """The media stream handshake is signed over the stream URL as the TwiML gave it (wss://), or its https:// form."""
    https = f"{public_url}/twilio/media"
    wss = "ws" + https[4:] if https.startswith("http") else https
    return valid_twilio_signature(auth_token, wss, {}, signature) or valid_twilio_signature(auth_token, https, {}, signature)


def _text(s: str) -> str:
    return "".join(f"&#{ord(c)};" if c in "<>&'\"" else c for c in s)


def stream_twiml(stream_url: str, parameters: dict[str, str], action: str) -> str:
    """Straight to the media stream. When the stream ends Twilio asks `action` what next: normally a
    hang-up, or a short apology if the agent never started."""
    params = "".join(f"<Parameter name={quoteattr(k)} value={quoteattr(v)}/>" for k, v in parameters.items())
    return f'<?xml version="1.0" encoding="UTF-8"?><Response><Connect action={quoteattr(action)}><Stream url={quoteattr(stream_url)}>{params}</Stream></Connect></Response>'


def notice_twiml(notice: str) -> str:
    """A short spoken notice and a polite hang-up, without opening a model session."""
    return f'<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">{_text(notice)}</Say><Hangup/></Response>'


def hangup_twiml() -> str:
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>'


def reject_twiml() -> str:
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>'
