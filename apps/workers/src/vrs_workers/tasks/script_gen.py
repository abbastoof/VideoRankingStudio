"""LLM-driven script generation and rewriting."""

from __future__ import annotations

from typing import Any

from ..celery_app import celery_app
from ..config import settings
from ._base import job_lifecycle, succeed


SYSTEM_SCRIPT_GEN = """You write short-form vertical video scripts.

Your output is a JSON object with this exact shape:
{
  "title": "...",
  "hook": "...",                  // first line that earns the next 3 seconds
  "scenes": [
    {"index": 1, "voiceover": "...", "onScreenText": "...", "broll": "..."},
    ...
  ],
  "callToAction": "..."
}

Constraints:
- Every voiceover beat must read aloud in under 7 seconds.
- Total runtime must fit the user's target duration ± 10%.
- No hashtags, no emoji, no markdown.
- Match the requested tone exactly."""


@celery_app.task(name="vrs.script.generate", bind=True, max_retries=2)
def generate_script(
    self,  # noqa: ANN001
    *,
    job_id: str,
    topic: str,
    tone: str,
    duration_ms: int,
    fmt: str,
    language: str = "en",
) -> dict[str, Any]:
    with job_lifecycle(job_id, "script_generate") as report:
        report(0.2, f"calling {settings.llm_provider}")
        prompt = (
            f"Topic: {topic}\nTone: {tone}\nFormat: {fmt}\nLanguage: {language}\n"
            f"Target duration: {duration_ms // 1000} seconds.\n"
            "Return only JSON. Do not wrap it in code fences."
        )
        text = _llm_complete(SYSTEM_SCRIPT_GEN, prompt)
        report(0.85, "parsing")
        try:
            import json
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"LLM returned non-JSON: {exc}") from exc
        succeed(job_id, {"script": data, "raw": text})
        return {"script": data, "raw": text}


@celery_app.task(name="vrs.script.rewrite", bind=True, max_retries=2)
def rewrite_script(
    self,  # noqa: ANN001
    *,
    job_id: str,
    text: str,
    goal: str,
    target_language: str | None = None,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "script_rewrite") as report:
        sys = {
            "clarify": "Rewrite the input for clarity. Keep the same meaning, tone, and approximate length.",
            "shorten": "Rewrite the input 30–40% shorter without losing the core idea.",
            "punchier": "Rewrite the input to be punchier and more energetic. Keep length.",
            "simpler": "Rewrite the input at a 6th-grade reading level. Keep meaning.",
            "translate": f"Translate the input into {target_language or 'English'}. Preserve formatting.",
        }.get(goal, "Rewrite the input for clarity.")
        report(0.3)
        out = _llm_complete(sys, text)
        succeed(job_id, {"text": out})
        return {"text": out}


def _llm_complete(system: str, user: str) -> str:
    if settings.llm_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is required")
        from anthropic import Anthropic

        client = Anthropic(api_key=settings.anthropic_api_key)
        resp = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        # Concat text blocks
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")

    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required")
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.7,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        return resp.choices[0].message.content or ""

    raise RuntimeError(f"Unsupported LLM_PROVIDER: {settings.llm_provider}")
