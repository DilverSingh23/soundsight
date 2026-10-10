"""Local YAMNet inference and diagnostic mapping; no notification filtering."""
import csv
from pathlib import Path

# Resolve indexes through the model's class map rather than assuming positions.
CLASS_LABELS = {
    "siren": {
        "general": ("Siren",),
        "civil_defense": ("Civil defense siren",),
        "police": ("Police car (siren)",),
        "ambulance": ("Ambulance (siren)",),
        "fire_engine": ("Fire engine, fire truck (siren)",),
    },
    "doorbell": {"general": ("Doorbell", "Ding-dong")},
    "dog": {"bark": ("Bark",)},
    "horn": {"general": ("Vehicle horn, car horn, honking", "Air horn, truck horn")},
    "speech": {"general": ("Speech", "Child speech, kid speaking", "Conversation")},
}
# Provisional subtype-selection criteria, not notification thresholds.
SIREN_SUBTYPE_MIN_SCORE = 0.5
SIREN_SUBTYPE_MARGIN = 0.1


def map_scores(labels: list[str], scores: list[float]) -> list[dict]:
    if len(labels) != len(scores):
        raise ValueError("Score count must match the model class map.")
    by_label = dict(zip(labels, scores))
    results = []
    for category, subtypes in CLASS_LABELS.items():
        candidates = []
        for subtype, names in subtypes.items():
            for name in names:
                if name not in by_label:
                    raise ValueError(f"Required YAMNet label missing: {name}")
                candidates.append((float(by_label[name]), subtype, name))
        candidates.sort(reverse=True)
        score, subtype, raw_class = candidates[0]
        if category == "siren" and subtype != "general":
            specific = sorted((item for item in candidates if item[1] != "general"), reverse=True)
            if score < SIREN_SUBTYPE_MIN_SCORE or score - specific[1][0] < SIREN_SUBTYPE_MARGIN:
                subtype = "general"
        results.append({"category": category, "subtype": subtype, "score": score, "raw_class": raw_class})
    return sorted(results, key=lambda item: item["score"], reverse=True)


class YamnetClassifier:
    def __init__(self, model_directory: str):
        # Optional heavy dependency: base backend and tests work without TensorFlow.
        import tensorflow as tf
        self.tf = tf
        self.model = tf.saved_model.load(str(Path(model_directory).resolve()))
        class_map = self.model.class_map_path().numpy().decode()
        with open(class_map, newline="") as file:
            rows = sorted(csv.DictReader(file), key=lambda row: int(row["index"]))
        self.labels = [row["display_name"] for row in rows]
        if len(self.labels) != 521:
            raise ValueError("Expected the 521-class YAMNet model.")
        map_scores(self.labels, [0.0] * len(self.labels))
        # Warm up once before accepting streams.
        self.model(tf.zeros([15600], dtype=tf.float32))

    def classify(self, pcm: bytes) -> list[dict]:
        import numpy as np
        waveform = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        scores, _embeddings, _spectrogram = self.model(self.tf.convert_to_tensor(waveform))
        # Max across output frames preserves brief events. This is an MVP policy.
        return map_scores(self.labels, scores.numpy().max(axis=0).tolist())
