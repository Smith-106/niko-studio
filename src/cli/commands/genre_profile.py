"""Shared genre profile helpers for CLI workflow commands."""

from typing import Any, Dict, Optional

GENRE_CHOICES = ("none", "mystery", "scifi", "xuanhuan", "悬疑", "科幻", "东方玄幻")

_GENRE_ALIASES = {
    "none": "none",
    "mystery": "mystery",
    "悬疑": "mystery",
    "scifi": "scifi",
    "sci-fi": "scifi",
    "科幻": "scifi",
    "xuanhuan": "xuanhuan",
    "东方玄幻": "xuanhuan",
}

_GENRE_GENERATION_PROFILES: Dict[str, Dict[str, Any]] = {
    "mystery": {
        "style": "cinematic",
        "length": "medium",
        "constraints": [
            "Maintain clue consistency across all scenes",
            "Control information reveal cadence",
            "Keep deduction chain explicit and verifiable",
        ],
    },
    "scifi": {
        "style": "neutral",
        "length": "medium",
        "constraints": [
            "Keep speculative rules internally consistent",
            "Ground technology through character action",
            "Preserve cause-effect logic from world rules",
        ],
    },
    "xuanhuan": {
        "style": "lyrical",
        "length": "long",
        "constraints": [
            "Keep realm progression and power boundaries consistent",
            "Maintain sect hierarchy and world lore continuity",
            "Balance cultivation exposition with scene momentum",
        ],
    },
}


def normalize_genre(genre: str) -> str:
    normalized = (genre or "none").strip().lower()
    return _GENRE_ALIASES.get(normalized, normalized)


def genre_profile(genre: str) -> Optional[Dict[str, Any]]:
    normalized_genre = normalize_genre(genre)
    if normalized_genre == "none":
        return None
    profile = _GENRE_GENERATION_PROFILES.get(normalized_genre)
    if not profile:
        return None
    return {
        "style": profile["style"],
        "length": profile["length"],
        "constraints": list(profile["constraints"]),
    }


def genre_to_generation_recommendation(genre: str) -> Optional[Dict[str, Any]]:
    profile = genre_profile(genre)
    if profile is None:
        return None
    return {
        "action": "set_generation_controls",
        "target": "draft",
        "params": profile,
    }


def merge_controls_with_genre(controls: Dict[str, Any], genre: str) -> Dict[str, Any]:
    merged = {
        "style": controls.get("style", "neutral"),
        "length": controls.get("length", "medium"),
        "constraints": list(controls.get("constraints", [])),
    }
    profile = genre_profile(genre)
    if profile is None:
        return merged

    if merged["style"] == "neutral":
        merged["style"] = profile["style"]

    if merged["length"] == "medium":
        merged["length"] = profile["length"]

    existing_constraints = set(merged["constraints"])
    for item in profile["constraints"]:
        if item not in existing_constraints:
            merged["constraints"].append(item)
            existing_constraints.add(item)

    return merged
