"""Loads versioned prompt templates (files named `<ref>.v<N>.md`)."""

import re
from dataclasses import dataclass
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent / "prompts"
_PATTERN = re.compile(r"^(?P<ref>[a-z0-9_]+)\.v(?P<version>\d+)\.md$")


@dataclass(frozen=True)
class Prompt:
    ref: str
    version: str
    text: str


def load_prompt(ref: str, version: int | None = None) -> Prompt:
    candidates: dict[int, Path] = {}
    for path in PROMPTS_DIR.glob(f"{ref}.v*.md"):
        match = _PATTERN.match(path.name)
        if match and match.group("ref") == ref:
            candidates[int(match.group("version"))] = path
    if not candidates:
        raise FileNotFoundError(f"no prompt files found for ref '{ref}'")
    chosen = version if version is not None else max(candidates)
    if chosen not in candidates:
        raise FileNotFoundError(f"prompt '{ref}' has no version {chosen}")
    return Prompt(ref=ref, version=f"v{chosen}", text=candidates[chosen].read_text())
