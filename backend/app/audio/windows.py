"""Connection-local PCM windows, timestamped by sample position."""
from dataclasses import dataclass

SAMPLE_RATE_HZ = 16000
BYTES_PER_SAMPLE = 2
WINDOW_SAMPLES = 15600  # 0.975 s covers one complete YAMNet analysis frame.
HOP_SAMPLES = 7680  # 0.48 s.


@dataclass(frozen=True)
class AudioWindow:
    pcm: bytes
    start_sample: int

    @property
    def start_seconds(self) -> float:
        return self.start_sample / SAMPLE_RATE_HZ

    @property
    def end_seconds(self) -> float:
        return (self.start_sample + len(self.pcm) // BYTES_PER_SAMPLE) / SAMPLE_RATE_HZ


class AudioWindowBuffer:
    def __init__(self):
        self.pending = bytearray()
        self.start_sample = 0

    def feed(self, pcm: bytes) -> list[AudioWindow]:
        if len(pcm) % BYTES_PER_SAMPLE:
            raise ValueError("PCM must contain complete 16-bit samples.")
        self.pending.extend(pcm)
        windows = []
        while len(self.pending) >= WINDOW_SAMPLES * BYTES_PER_SAMPLE:
            windows.append(AudioWindow(bytes(self.pending[:WINDOW_SAMPLES * BYTES_PER_SAMPLE]), self.start_sample))
            del self.pending[:HOP_SAMPLES * BYTES_PER_SAMPLE]
            self.start_sample += HOP_SAMPLES
        return windows
