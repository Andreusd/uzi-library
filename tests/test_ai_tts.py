import os
import sys
import wave
import io
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.main import app
from server.ai.tts import AI_VOICES, pcm_to_wav, get_cache_path, synthesize_speech

@pytest.fixture
def client():
    return TestClient(app)

def test_pcm_to_wav_utility():
    # 24000 samples of 16-bit mono silence (48000 bytes = 1 second)
    pcm = b"\x00" * 48000
    wav = pcm_to_wav(pcm, sample_rate=24000, num_channels=1, sample_width=2)
    assert len(wav) == 48000 + 44
    assert wav[:4] == b"RIFF"
    assert wav[8:12] == b"WAVE"

    with wave.open(io.BytesIO(wav), 'rb') as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == 24000
        assert wf.getnframes() == 24000

def test_get_ai_tts_voices_endpoint(client):
    res = client.get("/api/ai/tts/voices")
    assert res.status_code == 200
    data = res.json()
    assert "voices" in data
    assert "available" in data
    assert len(data["voices"]) >= 5
    voice_ids = [v["id"] for v in data["voices"]]
    assert "Aoede" in voice_ids
    assert "Puck" in voice_ids
    assert "Kore" in voice_ids

def test_post_ai_tts_empty_text(client):
    res = client.post("/api/ai/tts", json={"text": "   ", "voice": "Aoede"})
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()

def test_get_ai_tts_empty_text(client):
    res = client.get("/api/ai/tts?text=%20%20&voice=Aoede")
    assert res.status_code == 400

@patch("server.routers.ai.synthesize_speech", new_callable=AsyncMock)
def test_post_ai_tts_success(mock_synth, client):
    dummy_wav = b"RIFF" + b"\x00" * 40
    mock_synth.return_value = dummy_wav

    res = client.post("/api/ai/tts", json={"text": "Once upon a time", "voice": "Aoede"})
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/wav"
    assert res.content == dummy_wav
    mock_synth.assert_awaited_once_with(text="Once upon a time", voice="Aoede")

@patch("server.routers.ai.synthesize_speech", new_callable=AsyncMock)
def test_get_ai_tts_success(mock_synth, client):
    dummy_wav = b"RIFF" + b"\x00" * 40
    mock_synth.return_value = dummy_wav

    res = client.get("/api/ai/tts?text=Chapter%20One&voice=Puck")
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/wav"
    assert res.content == dummy_wav
    mock_synth.assert_awaited_once_with(text="Chapter One", voice="Puck")
