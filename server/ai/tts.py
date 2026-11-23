"""
AI Text-to-Speech service using Google Gemini native AUDIO response modality.
Provides prebuilt expressive voices, WAV conversion, and disk caching.
"""
import os
import io
import wave
import json
import base64
import hashlib
import asyncio
from typing import Optional, List, Dict
from pathlib import Path
import httpx
from server.database import get_db

CACHE_DIR = Path("data/tts_cache")

AI_VOICES: List[Dict[str, str]] = [
    {
        "id": "Aoede",
        "name": "Aoede (Melodic & Expressive)",
        "gender": "female",
        "description": "Warm, melodious, and rich with emotion. Ideal for literature and storytelling."
    },
    {
        "id": "Kore",
        "name": "Kore (Calm & Soothing)",
        "gender": "female",
        "description": "Gentle, clear, and steady. Perfect for non-fiction, essays, and relaxing reads."
    },
    {
        "id": "Puck",
        "name": "Puck (Energetic & Dynamic)",
        "gender": "male",
        "description": "Lively, expressive, and engaging. Great for adventure and character dialogue."
    },
    {
        "id": "Fenrir",
        "name": "Fenrir (Authoritative & Deep)",
        "gender": "male",
        "description": "Resonant, powerful, and commanding. Suited for epic fiction, history, and thrillers."
    },
    {
        "id": "Charon",
        "name": "Charon (Steady & Contemplative)",
        "gender": "male",
        "description": "Deep, solemn, and thoughtful. Excellent for philosophy and dramatic narratives."
    },
]

def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 24000, num_channels: int = 1, sample_width: int = 2) -> bytes:
    """Wraps raw 16-bit PCM bytes into a standard playable WAV container."""
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav_file:
        wav_file.setnchannels(num_channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return buf.getvalue()

def get_cache_path(voice: str, text: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(f"{voice.strip()}:{text.strip()}".encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{digest}.wav"

async def synthesize_speech(text: str, voice: str = "Aoede", api_key: Optional[str] = None) -> bytes:
    clean_text = (text or "").strip()
    if not clean_text:
        raise ValueError("Text cannot be empty")

    voice_name = (voice or "Aoede").strip()
    # Normalize casing or fallback
    found = False
    for v in AI_VOICES:
        if v["id"].lower() == voice_name.lower():
            voice_name = v["id"]
            found = True
            break
    if not found:
        voice_name = "Aoede"

    # 1. Check local disk cache
    cache_path = get_cache_path(voice_name, clean_text)
    if cache_path.exists() and cache_path.stat().st_size > 44:
        return cache_path.read_bytes()

    # 2. Resolve API key
    key = api_key or get_db().get_setting("gemini_api_key") or os.environ.get("GEMINI_API_KEY", "")
    key = key.strip() if key else ""
    if not key:
        raise ValueError("Gemini API key is not configured. Please enter your API key in AI Settings.")

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"Read the following text aloud naturally and expressively as a professional audiobook narrator. Speak only the exact text without any introductory or concluding comments:\n\n{clean_text}"
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": voice_name
                    }
                }
            }
        }
    }

    models_to_try = [
        "gemini-3.8-flash-tts",
        "gemini-3.8-flash-lite-tts",
        "gemini-2.5-flash-preview-tts",
        "gemini-3.1-flash-tts-preview"
    ]

    last_error = ""
    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            for retry in range(2):
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if not candidates:
                            raise ValueError("Gemini returned empty candidates")

                        parts = candidates[0].get("content", {}).get("parts", [])
                        for p in parts:
                            if "inlineData" in p:
                                mime = p["inlineData"].get("mimeType", "").lower()
                                b64_data = p["inlineData"].get("data", "")
                                raw_bytes = base64.b64decode(b64_data)

                                if "wav" in mime or raw_bytes[:4] == b"RIFF":
                                    wav_bytes = raw_bytes
                                else:
                                    wav_bytes = pcm_to_wav(raw_bytes, sample_rate=24000)

                                # Persist to disk cache
                                try:
                                    cache_path.write_bytes(wav_bytes)
                                except Exception:
                                    pass

                                return wav_bytes
                        raise ValueError("No audio inlineData found in Gemini response")

                    elif resp.status_code in (429, 503) and retry == 0:
                        await asyncio.sleep(1.2)
                        continue
                    else:
                        last_error = f"Gemini API returned status {resp.status_code}: {resp.text[:300]}"
                        break
                except Exception as e:
                    last_error = str(e)
                    break

    raise RuntimeError(f"Failed to synthesize speech: {last_error}")
