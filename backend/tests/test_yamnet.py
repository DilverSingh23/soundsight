import pytest
from app.audio.yamnet import CLASS_LABELS, map_scores


def inputs(values):
    labels = list(dict.fromkeys(name for groups in CLASS_LABELS.values() for names in groups.values() for name in names))
    return labels, [values.get(label, 0.0) for label in labels]


def test_mapping_uses_labels_not_fixed_indexes():
    labels, scores = inputs({"Bark": 0.8, "Ding-dong": 0.7})
    result = map_scores(labels[::-1], scores[::-1])
    assert result[0] == {"category": "dog", "subtype": "bark", "score": 0.8, "raw_class": "Bark"}
    assert next(item for item in result if item["category"] == "doorbell")["score"] == 0.7


@pytest.mark.parametrize("values,expected", [
    ({"Ambulance (siren)": 0.8, "Police car (siren)": 0.2}, "ambulance"),
    ({"Ambulance (siren)": 0.8, "Police car (siren)": 0.75}, "general"),
    ({"Ambulance (siren)": 0.3}, "general"),
    ({"Siren": 0.9, "Ambulance (siren)": 0.6}, "general"),
])
def test_siren_specificity(values, expected):
    labels, scores = inputs(values)
    assert next(item for item in map_scores(labels, scores) if item["category"] == "siren")["subtype"] == expected


def test_missing_model_labels_fail_explicitly():
    with pytest.raises(ValueError):
        map_scores(["Speech"], [0.8])


