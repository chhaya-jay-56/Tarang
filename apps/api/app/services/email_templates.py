# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# HTML email templates for Tarang user engagement emails. Each template is a
# function that accepts user data and returns rendered HTML.
#
# DESIGN DECISIONS:
#   - Inline CSS only (email clients strip <style> tags)
#   - Simple, clean layout — no heavy images (faster load, better deliverability)
#   - Every email ends with feedback link + "we're in early stages" tone
#   - Personal tone: from Jay, not "the Tarang team"
#   - Mobile-friendly: max-width 600px, large tap targets
# ─────────────────────────────────────────────────────────────────────────────

from typing import Optional

# ── Shared layout wrapper ──

STUDIO_URL = "https://studio.trytarang.app"
LANDING_URL = "https://trytarang.app"
FEEDBACK_URL = f"{LANDING_URL}/#feedback"

# Feature deep links
FEATURE_LINKS = {
    "clone": f"{STUDIO_URL}/instant-voice-clone",
    "tts": f"{STUDIO_URL}/text-to-speech",
    "separation": f"{STUDIO_URL}/voice-separation",
    "voice_creation": f"{STUDIO_URL}/voice-creation",
    "voice_insight": f"{STUDIO_URL}/voice-insight",
    "voice_library": f"{STUDIO_URL}/voice-library",
}

# Feature display names
FEATURE_NAMES = {
    "clone": "Instant Voice Clone",
    "tts": "Text-to-Speech",
    "separation": "Voice Separation",
    "voice_creation": "Voice Creation",
    "voice_insight": "Voice Insight",
    "voice_library": "Voice Library",
}

FEATURE_EMOJIS = {
    "clone": "🎙️",
    "tts": "🗣️",
    "separation": "🎵",
    "voice_creation": "🎨",
    "voice_insight": "🔍",
    "voice_library": "📚",
}

FEATURE_DESCRIPTIONS = {
    "clone": "Upload a 10-second audio clip, get your AI voice instantly",
    "tts": "Type text, pick a voice, get studio-quality audio",
    "separation": "Split any song into vocals, drums, bass & instruments",
    "voice_creation": "Design a custom AI voice from scratch",
    "voice_insight": "Analyze any voice clip for detailed characteristics",
    "voice_library": "Browse and use pre-built voices from the community",
}


def _wrap_email(content: str) -> str:
    """Wraps email content in a clean, mobile-friendly layout."""
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <a href="{LANDING_URL}" style="text-decoration:none;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
                🎵 Tarang
              </a>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="color:#e0e0e0;font-size:15px;line-height:1.7;">
              {content}
            </td>
          </tr>
          <!-- Footer: Feedback + early stages -->
          <tr>
            <td style="padding-top:32px;border-top:1px solid #222;margin-top:32px;">
              <p style="color:#888;font-size:13px;line-height:1.6;margin:16px 0 0;">
                Tarang is in its early stages and your input shapes what we build next.
                <a href="{FEEDBACK_URL}" style="color:#a78bfa;text-decoration:none;">Share feedback or ideas →</a>
              </p>
              <p style="color:#666;font-size:12px;margin:12px 0 0;">
                You're receiving this because you signed up on Tarang.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _cta_button(text: str, url: str) -> str:
    """Renders a CTA button that works across email clients."""
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:#7c3aed;border-radius:8px;padding:12px 28px;">
          <a href="{url}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">
            {text}
          </a>
        </td>
      </tr>
    </table>
    """


# ── Template: Onboarding Nudge (Segment B — never used) ──

def onboarding_nudge(
    name: str,
    credit_balance: int,
) -> tuple[str, str]:
    """Returns (subject, html_body) for onboarding nudge email."""
    first_name = name.split()[0] if name else "there"

    subject = "🎙️ Your free credits are waiting — clone your voice in 60 seconds"

    content = f"""
    <p style="margin:0 0 16px;">Hey {first_name},</p>

    <p style="margin:0 0 16px;">
      You signed up for Tarang but haven't tried it yet! Here's the fastest way to start:
    </p>

    <p style="margin:0 0 8px;font-weight:600;color:#ffffff;">
      Upload a 10-second audio clip → Tarang creates your AI voice instantly.
    </p>

    {_cta_button("Try Instant Voice Clone →", FEATURE_LINKS["clone"])}

    <p style="margin:0 0 16px;color:#a0a0a0;">
      You have <strong style="color:#ffffff;">{credit_balance:,} free credits</strong> to experiment with. No credit card needed.
    </p>

    <p style="margin:0;color:#a0a0a0;">— Jay, builder of Tarang</p>
    """

    return subject, _wrap_email(content)


# ── Template: Re-engagement (Segment A — used once, inactive) ──

def re_engagement(
    name: str,
    credit_balance: int,
    used_features: list[str],
) -> tuple[str, str]:
    """Returns (subject, html_body) for re-engagement email.

    Dynamically shows features the user HASN'T tried yet.
    """
    first_name = name.split()[0] if name else "there"

    # Features they haven't used
    all_features = set(FEATURE_NAMES.keys())
    unused = all_features - set(used_features)

    # Build the "what you've used" line
    if used_features:
        used_names = [FEATURE_NAMES.get(f, f) for f in used_features[:2]]
        used_text = " and ".join(used_names)
    else:
        used_text = "Tarang"

    subject = f"You tried {used_text} — here's what else Tarang can do 🎵"

    # Build unused feature list
    feature_list = ""
    for feat in sorted(unused):
        if feat in FEATURE_NAMES:
            emoji = FEATURE_EMOJIS.get(feat, "✨")
            name_text = FEATURE_NAMES[feat]
            desc = FEATURE_DESCRIPTIONS[feat]
            link = FEATURE_LINKS[feat]
            feature_list += f"""
            <tr>
              <td style="padding:8px 0;color:#e0e0e0;font-size:14px;">
                {emoji} <a href="{link}" style="color:#a78bfa;text-decoration:none;font-weight:600;">{name_text}</a>
                — {desc}
              </td>
            </tr>
            """

    content = f"""
    <p style="margin:0 0 16px;">Hey {first_name},</p>

    <p style="margin:0 0 16px;">
      You've already tried {used_text} on Tarang! Here's what else you can do with your
      remaining <strong style="color:#ffffff;">{credit_balance:,} credits</strong>:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;width:100%;">
      {feature_list}
    </table>

    {_cta_button("Open Tarang Studio →", STUDIO_URL)}

    <p style="margin:0;color:#a0a0a0;">— Jay, builder of Tarang</p>
    """

    return subject, _wrap_email(content)


# ── Template: Creative Feedback Ask (both segments) ──

def feedback_ask(
    name: str,
) -> tuple[str, str]:
    """Returns (subject, html_body) for creative feedback email."""
    first_name = name.split()[0] if name else "there"

    subject = "Quick question — if you could add one thing to Tarang, what would it be?"

    content = f"""
    <p style="margin:0 0 16px;">Hey {first_name},</p>

    <p style="margin:0 0 16px;">
      I'm building Tarang and I'd love your honest take —
      <strong style="color:#ffffff;">what's the one feature you wish existed?</strong>
    </p>

    <p style="margin:0 0 8px;color:#a0a0a0;">Some ideas users have asked about:</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;">
      <tr><td style="padding:6px 0;color:#e0e0e0;font-size:14px;">🎬 <strong>AI Dubbing</strong> — automatically dub videos into other languages</td></tr>
      <tr><td style="padding:6px 0;color:#e0e0e0;font-size:14px;">🎤 <strong>Voice Marketplace</strong> — share and discover community voices</td></tr>
      <tr><td style="padding:6px 0;color:#e0e0e0;font-size:14px;">📱 <strong>Mobile App</strong> — use Tarang on your phone</td></tr>
    </table>

    {_cta_button("Tell me what you want (30 seconds) →", FEEDBACK_URL)}

    <p style="margin:0 0 16px;color:#a0a0a0;">
      Every response goes directly to me. Seriously — I read each one.
    </p>

    <p style="margin:0;color:#a0a0a0;">— Jay, builder of Tarang</p>
    """

    return subject, _wrap_email(content)


# ── Template: Credit Grant (broadcast to all) ──

def credit_grant(
    name: str,
    credit_balance: int,
    highlight_feature: Optional[str] = None,
) -> tuple[str, str]:
    """Returns (subject, html_body) for credit grant email.

    highlight_feature: optional feature key to spotlight (random if not set).
    """
    first_name = name.split()[0] if name else "there"

    subject = "🎁 You just got 10,000 free credits on Tarang"

    # Pick a feature to highlight
    feat = highlight_feature or "separation"
    feat_name = FEATURE_NAMES.get(feat, "Voice Separation")
    feat_desc = FEATURE_DESCRIPTIONS.get(feat, "")
    feat_link = FEATURE_LINKS.get(feat, STUDIO_URL)

    content = f"""
    <p style="margin:0 0 16px;">Hey {first_name},</p>

    <p style="margin:0 0 16px;">
      As a thank-you for being an early user, I've added
      <strong style="color:#ffffff;">10,000 free credits</strong> to your Tarang account.
    </p>

    <p style="margin:0 0 8px;color:#a0a0a0;">Here's what I'd love you to try:</p>

    <p style="margin:0 0 20px;color:#e0e0e0;font-size:14px;">
      {FEATURE_EMOJIS.get(feat, "✨")} <a href="{feat_link}" style="color:#a78bfa;text-decoration:none;font-weight:600;">{feat_name}</a>
      — {feat_desc}
    </p>

    {_cta_button(f"Try {feat_name} →", feat_link)}

    <p style="margin:0 0 16px;color:#a0a0a0;">
      Your new balance: <strong style="color:#ffffff;">{credit_balance:,} credits</strong>
    </p>

    <p style="margin:0;color:#a0a0a0;">— Jay, builder of Tarang</p>
    """

    return subject, _wrap_email(content)


# ── Template: Custom email (admin-composed) ──

def custom_email(
    name: str,
    credit_balance: int,
    subject: str,
    body_text: str,
) -> tuple[str, str]:
    """Returns (subject, html_body) for admin-composed custom email.

    Supports placeholders: {name}, {credit_balance} in both subject and body.
    """
    first_name = name.split()[0] if name else "there"

    # Replace placeholders
    rendered_subject = subject.replace("{name}", first_name).replace(
        "{credit_balance}", f"{credit_balance:,}"
    )
    rendered_body = body_text.replace("{name}", first_name).replace(
        "{credit_balance}", f"{credit_balance:,}"
    )

    # Convert newlines to <br> for HTML
    html_body = rendered_body.replace("\n", "<br>")

    content = f"""
    <div style="color:#e0e0e0;font-size:15px;line-height:1.7;">
      {html_body}
    </div>
    """

    return rendered_subject, _wrap_email(content)
