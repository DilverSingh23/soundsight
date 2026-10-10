
from dataclasses import dataclass, field
from math import isfinite
from uuid import uuid4


@dataclass
class CategoryConfig:
    threshold: float
    cooldown: float
    severity: str
    enabled: bool = True
    labels: dict[str, str] = field(default_factory=dict)


def default_config() -> dict[str, CategoryConfig]:
    return {
        "siren": CategoryConfig(
            threshold=0.5,
            cooldown=5.0,
            severity="critical",
            labels={
                "general": "Possible siren",
                "civil_defense": "Possible civil defense siren",
                "police": "Possible police siren",
                "ambulance": "Possible ambulance siren",
                "fire_engine": "Possible fire-engine siren",
            },
        ),
        "doorbell": CategoryConfig(
            threshold=0.5,
            cooldown=5.0,
            severity="important",
            labels={
                "general": "Possible doorbell",
            },
        ),
        "dog": CategoryConfig(
            threshold=0.3,
            cooldown=10.0,
            severity="ambient",
            labels={
                "bark": "Possible dog barking",
            },
        ),
        "horn": CategoryConfig(
            threshold=0.5,
            cooldown=5.0,
            severity="important",
            labels={
                "general": "Possible vehicle horn",
            },
        ),
    }

class SoundNotificationFilter:
    def __init__(
        self,
        config: dict[str, CategoryConfig] | None = None,
    ):
        self.config = (
            default_config() if config is None else config
        )

        # Each filter instance tracks its own session.
        self.last_emitted: dict[str, float] = {}
        self.last_audio_time: float | None = None

    def process(
        self,
        category: str,
        score: float,
        audio_time: float,
        subtype: str = "general",
    ) -> dict | None:

        # Validate the category and subtype.
        if not isinstance(category, str):
            return None

        settings = self.config.get(category)

        if settings is None or not settings.enabled:
            return None

        if not isinstance(subtype, str):
            return None

        if subtype not in settings.labels:
            return None

        # Reject invalid scores and timestamps.
        if (
            isinstance(score, bool)
            or not isinstance(score, (int, float))
            or not isfinite(score)
            or not 0 <= score <= 1
        ):
            return None

        if (
            isinstance(audio_time, bool)
            or not isinstance(audio_time, (int, float))
            or not isfinite(audio_time)
            or audio_time < 0
        ):
            return None

        # Ignore audio arriving out of chronological order.
        if (
            self.last_audio_time is not None
            and audio_time < self.last_audio_time
        ):
            return None

        self.last_audio_time = audio_time

        # Check the classification threshold.
        if score < settings.threshold:
            return None

        # Check category-level cooldown.
        previous = self.last_emitted.get(category)

        if (
            previous is not None
            and audio_time - previous < settings.cooldown
        ):
            return None

        # Create an approved notification.
        event = {
            "type": "sound_event",
            "id": str(uuid4()),
            "category": category,
            "subtype": subtype,
            "label": settings.labels[subtype],
            "score": float(score),
            "audio_time": float(audio_time),
            "severity": settings.severity,
        }

        # Update cooldown only after emitting an event.
        self.last_emitted[category] = audio_time

        return event
