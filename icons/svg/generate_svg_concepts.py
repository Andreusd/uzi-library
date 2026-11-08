import os
from pathlib import Path
import subprocess

SVG_DIR = Path("/home/andreusd/Documents/Projects/UziLibrary/icons/svg")
SVG_DIR.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------------------
# Concept 1: Direct Evolution of the Classic Uzi Library Icon
# Blending the exact book page geometry with a bold 'U' silhouette
# -------------------------------------------------------------
svg_1 = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="goldGradLeft" x1="15%" y1="10%" x2="85%" y2="90%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="40%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="goldGradRight" x1="85%" y1="10%" x2="15%" y2="90%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="40%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="spineShadow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#78350F" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#78350F" stop-opacity="0.1"/>
    </linearGradient>
    <filter id="subtleDrop" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Left 'U' Page Wing -->
  <path d="M 120 120
           C 120 105, 135 95, 150 100
           C 195 115, 230 135, 252 165
           C 256 170, 256 185, 256 370
           C 235 348, 195 330, 150 330
           C 130 330, 120 342, 120 365
           L 120 120 Z"
        fill="url(#goldGradLeft)"
        stroke="#1C1917"
        stroke-width="16"
        stroke-linejoin="round"
        stroke-linecap="round"
        filter="url(#subtleDrop)"/>

  <!-- Right 'U' Page Wing -->
  <path d="M 392 120
           C 392 105, 377 95, 362 100
           C 317 115, 282 135, 260 165
           C 256 170, 256 185, 256 370
           C 277 348, 317 330, 362 330
           C 382 330, 392 342, 392 365
           L 392 120 Z"
        fill="url(#goldGradRight)"
        stroke="#1C1917"
        stroke-width="16"
        stroke-linejoin="round"
        stroke-linecap="round"
        filter="url(#subtleDrop)"/>

  <!-- Lower U-loop connection: binds the two book pages into a bold, continuous 'U' -->
  <path d="M 120 350
           C 120 425, 175 465, 256 465
           C 337 465, 392 425, 392 350
           C 392 320, 365 320, 365 350
           C 365 405, 320 435, 256 435
           C 192 435, 147 405, 147 350
           C 147 320, 120 320, 120 350 Z"
        fill="url(#goldGradLeft)"
        stroke="#1C1917"
        stroke-width="14"
        stroke-linejoin="round"/>

  <!-- Classic page lines from current Uzi Library icon -->
  <line x1="160" y1="180" x2="220" y2="198" stroke="#78350F" stroke-width="10" stroke-linecap="round" opacity="0.6"/>
  <line x1="160" y1="225" x2="220" y2="243" stroke="#78350F" stroke-width="10" stroke-linecap="round" opacity="0.6"/>
  <line x1="160" y1="270" x2="215" y2="286" stroke="#78350F" stroke-width="10" stroke-linecap="round" opacity="0.6"/>

  <line x1="352" y1="180" x2="292" y2="198" stroke="#78350F" stroke-width="10" stroke-linecap="round" opacity="0.6"/>
  <line x1="352" y1="225" x2="292" y2="243" stroke="#78350F" stroke-width="10" stroke-linecap="round" opacity="0.6"/>
  <line x1="352" y1="270" x2="297" y2="286" stroke="#78350F" stroke-width="10" stroke-linecap="round" opacity="0.6"/>
</svg>"""

# -------------------------------------------------------------
# Concept 2: Pure Minimalist Monoline / Geometric Stroke
# Modern, sleek, single harmonic rhythm forming both Book & 'U'
# -------------------------------------------------------------
svg_2 = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1E24"/>
      <stop offset="100%" stop-color="#0E0E11"/>
    </linearGradient>
  </defs>

  <!-- Modern dark squircle base -->
  <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#bgGrad)" stroke="#27272A" stroke-width="4"/>

  <!-- Left & Right Page Outer 'U' Stems -->
  <path d="M 145 130
           L 145 320
           C 145 390, 195 425, 256 425
           C 317 425, 367 390, 367 320
           L 367 130"
        fill="none"
        stroke="url(#lineGrad)"
        stroke-width="28"
        stroke-linecap="round"
        stroke-linejoin="round"/>

  <!-- Open Book Page Tops curving into center spine -->
  <path d="M 145 130
           C 185 155, 225 160, 256 185
           C 287 160, 327 155, 367 130"
        fill="none"
        stroke="url(#lineGrad)"
        stroke-width="26"
        stroke-linecap="round"
        stroke-linejoin="round"/>

  <!-- Center vertical spine line -->
  <line x1="256" y1="185" x2="256" y2="350"
        stroke="url(#lineGrad)"
        stroke-width="24"
        stroke-linecap="round"/>

  <!-- Minimalist reading bookmark tag / accent -->
  <polygon points="256,350 240,385 256,375 272,385" fill="#FDE68A"/>
</svg>"""

# -------------------------------------------------------------
# Concept 3: Modern Swiss Negative Space Glyph
# Solid iconic 'U' with crisp book-notch carving
# -------------------------------------------------------------
svg_3 = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="goldSolid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
  </defs>

  <!-- The Bold 'U' Book Glyph -->
  <!-- Outer U curve, with the top inner cut shaped exactly like an open book -->
  <path d="M 110 100
           L 180 100
           C 180 200, 200 230, 240 230
           L 240 140
           C 246 142, 250 144, 256 146
           C 262 144, 266 142, 272 140
           L 272 230
           C 312 230, 332 200, 332 100
           L 402 100
           L 402 300
           C 402 390, 336 440, 256 440
           C 176 440, 110 390, 110 300
           Z"
        fill="url(#goldSolid)"
        stroke="#18181B"
        stroke-width="12"
        stroke-linejoin="round"/>

  <!-- Open page lines carved inside the left & right stems -->
  <path d="M 135 150 C 155 160, 175 165, 195 165" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.85"/>
  <path d="M 135 195 C 155 205, 175 210, 195 210" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.85"/>

  <path d="M 377 150 C 357 160, 337 165, 317 165" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.85"/>
  <path d="M 377 195 C 357 205, 337 210, 317 210" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.85"/>
</svg>"""

# -------------------------------------------------------------
# Concept 4: Complete Refined App Icon (Direct Tray & Dock Ready)
# Combines the current open-book pages from generate_icons.py
# with an integrated rounded 'U' base and warm gradient styling
# -------------------------------------------------------------
svg_4 = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="squircleBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1F1F24"/>
      <stop offset="100%" stop-color="#121214"/>
    </linearGradient>
    <linearGradient id="pageLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="60%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="pageRight" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="60%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background squircle -->
  <rect x="32" y="32" width="448" height="448" rx="108" fill="url(#squircleBg)" stroke="#2D2D35" stroke-width="4"/>

  <!-- Soft Ambient Glow behind the book -->
  <circle cx="256" cy="260" r="140" fill="#F59E0B" opacity="0.15" filter="url(#glow)"/>

  <!-- U-Shaped Open Book Base & Pages -->
  <!-- Left Page / Left side of U -->
  <path d="M 125 140
           C 125 125, 145 115, 160 120
           C 200 135, 235 155, 256 180
           L 256 360
           C 230 335, 190 320, 150 320
           C 130 320, 125 330, 125 345
           L 125 140 Z"
        fill="url(#pageLeft)"
        stroke="#09090B"
        stroke-width="12"
        stroke-linejoin="round"/>

  <!-- Right Page / Right side of U -->
  <path d="M 387 140
           C 387 125, 367 115, 352 120
           C 312 135, 277 155, 256 180
           L 256 360
           C 282 335, 322 320, 362 320
           C 382 320, 387 330, 387 345
           L 387 140 Z"
        fill="url(#pageRight)"
        stroke="#09090B"
        stroke-width="12"
        stroke-linejoin="round"/>

  <!-- Integrated Bottom Spine U-Loop -->
  <path d="M 125 340
           C 125 415, 180 445, 256 445
           C 332 445, 387 415, 387 340
           C 387 310, 360 310, 360 338
           C 360 395, 315 418, 256 418
           C 197 418, 152 395, 152 338
           C 152 310, 125 310, 125 340 Z"
        fill="url(#pageLeft)"
        stroke="#09090B"
        stroke-width="12"
        stroke-linejoin="round"/>

  <!-- Internal page accents matching the original app icon -->
  <line x1="165" y1="195" x2="225" y2="215" stroke="#78350F" stroke-width="8" stroke-linecap="round" opacity="0.65"/>
  <line x1="165" y1="235" x2="225" y2="255" stroke="#78350F" stroke-width="8" stroke-linecap="round" opacity="0.65"/>
  <line x1="165" y1="275" x2="220" y2="295" stroke="#78350F" stroke-width="8" stroke-linecap="round" opacity="0.65"/>

  <line x1="347" y1="195" x2="287" y2="215" stroke="#78350F" stroke-width="8" stroke-linecap="round" opacity="0.65"/>
  <line x1="347" y1="235" x2="287" y2="255" stroke="#78350F" stroke-width="8" stroke-linecap="round" opacity="0.65"/>
  <line x1="347" y1="275" x2="292" y2="295" stroke="#78350F" stroke-width="8" stroke-linecap="round" opacity="0.65"/>
</svg>"""

files = {
    "concept_1_classic_u_blend.svg": svg_1,
    "concept_2_monoline_u_book.svg": svg_2,
    "concept_3_swiss_glyph_u.svg": svg_3,
    "concept_4_app_squircle_u.svg": svg_4,
}

for name, content in files.items():
    svg_path = SVG_DIR / name
    svg_path.write_text(content.strip(), encoding="utf-8")
    png_path = SVG_DIR / name.replace(".svg", ".png")
    # Convert to high-res PNG for preview in Telegram
    subprocess.run(["magick", "-background", "none", str(svg_path), "-resize", "512x512", str(png_path)], check=True)
    print(f"Created {svg_path} and {png_path}")
