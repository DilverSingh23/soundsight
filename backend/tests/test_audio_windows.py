import struct
import pytest
from app.audio.windows import AudioWindowBuffer, HOP_SAMPLES, WINDOW_SAMPLES


def test_windows_preserve_overlap_and_sample_timestamps():
    pcm = struct.pack("<30000h", *range(30000))
    buffer = AudioWindowBuffer()
    windows = []
    for offset in range(0, len(pcm), 3200):
        windows.extend(buffer.feed(pcm[offset:offset + 3200]))
    assert len(windows) == 2
    assert windows[0].pcm == pcm[:WINDOW_SAMPLES * 2]
    assert windows[1].pcm == pcm[HOP_SAMPLES * 2:(HOP_SAMPLES + WINDOW_SAMPLES) * 2]
    assert windows[0].start_seconds == 0
    assert windows[0].end_seconds == 0.975
    assert windows[1].start_seconds == 0.48
    assert len(buffer.pending) < WINDOW_SAMPLES * 2
    with pytest.raises(ValueError):
        buffer.feed(b"x")


