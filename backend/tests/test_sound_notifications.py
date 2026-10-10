
import math
import pytest

from app.events.sound_notifications import (
    SoundNotificationFilter,
    default_config,
)


@pytest.mark.parametrize("score,accepted", [(0.29, False), (0.3, True), (0.31, True)])
def test_barking_threshold(score, accepted):
    event = SoundNotificationFilter().process("dog", score, 0.0, "bark")
    assert (event is not None) is accepted


def test_above_threshold():
    f = SoundNotificationFilter()

    event = f.process("siren", 0.82, 0.0)

    assert event is not None
    assert event["label"] == "Possible siren"
    assert event["severity"] == "critical"


def test_below_threshold():
    f = SoundNotificationFilter()

    assert f.process("siren", 0.49, 0.0) is None


def test_exact_threshold():
    f = SoundNotificationFilter()

    assert f.process("siren", 0.5, 0.0) is not None


def test_cooldown():
    f = SoundNotificationFilter()

    assert f.process("siren", 0.8, 0.0) is not None
    assert f.process("siren", 0.9, 3.0) is None
    assert f.process("siren", 0.9, 5.0) is not None


def test_rejected_does_not_extend_cooldown():
    f = SoundNotificationFilter()

    assert f.process("siren", 0.8, 0.0) is not None
    assert f.process("siren", 0.9, 3.0) is None
    assert f.process("siren", 0.9, 5.0) is not None


def test_independent_categories():
    f = SoundNotificationFilter()

    assert f.process("siren", 0.8, 0.0) is not None
    assert f.process("doorbell", 0.8, 1.0) is not None
    assert f.process("siren", 0.8, 2.0) is None


def test_independent_sessions():
    first = SoundNotificationFilter()
    second = SoundNotificationFilter()

    assert first.process("siren", 0.8, 0.0) is not None
    assert second.process("siren", 0.8, 0.0) is not None


def test_disabled_category():
    config = default_config()
    config["siren"].enabled = False

    f = SoundNotificationFilter(config)

    assert f.process("siren", 0.9, 0.0) is None


def test_invalid_inputs():
    f = SoundNotificationFilter()

    for score in [-1, 1.5, math.nan, math.inf, -math.inf]:
        assert f.process("siren", score, 0.0) is None

    assert f.process("unknown", 0.8, 0.0) is None
    assert f.process("siren", 0.8, -1.0) is None
    assert f.process("siren", 0.8, math.nan) is None


def test_out_of_order_timestamp():
    f = SoundNotificationFilter()

    assert f.process("siren", 0.8, 10.0) is not None
    assert f.process("doorbell", 0.8, 9.0) is None


def test_siren_subtypes():
    expected = {
        "general": "Possible siren",
        "civil_defense": "Possible civil defense siren",
        "police": "Possible police siren",
        "ambulance": "Possible ambulance siren",
        "fire_engine": "Possible fire-engine siren",
    }

    for subtype, label in expected.items():
        f = SoundNotificationFilter()
        event = f.process("siren", 0.8, 0.0, subtype)

        assert event is not None
        assert event["label"] == label


def test_invalid_subtypes():
    f = SoundNotificationFilter()

    assert f.process("doorbell", 0.9, 0.0, "police") is None
    assert f.process("dog", 0.9, 0.0, "general") is None


def test_siren_subtype_cooldown():
    f = SoundNotificationFilter()

    assert f.process("siren", 0.8, 0.0, "police") is not None
    assert f.process("siren", 0.9, 2.0, "ambulance") is None
    assert f.process("siren", 0.9, 5.0, "ambulance") is not None


def test_event_fields_and_unique_ids():
    f = SoundNotificationFilter()

    first = f.process("dog", 0.8, 0.0, "bark")
    second = f.process("dog", 0.8, 10.0, "bark")

    assert first is not None
    assert second is not None

    assert set(first) == {
        "type",
        "id",
        "category",
        "subtype",
        "label",
        "score",
        "audio_time",
        "severity",
    }

    assert first["type"] == "sound_event"
    assert first["id"] != second["id"]
    assert first["category"] == "dog"
    assert first["subtype"] == "bark"
    assert first["severity"] == "ambient"
