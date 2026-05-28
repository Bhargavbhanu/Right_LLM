"""Dispatches an LLM call to the right provider.

For "live" providers (OpenAI, Anthropic, Gemini) we go through emergentintegrations'
LlmChat using the EMERGENT_LLM_KEY universal proxy.

For "configurable" providers (Groq, Ollama, Bedrock, Azure) we check that credentials
are configured (via the Settings UI or env), otherwise we surface a 501 with a clear
message telling the operator to provide a key. The MVP does not yet wire those
adapters — they appear in routing/analyzer/advisor based on published pricing only.
"""
import os
import time
import uuid

from fastapi import HTTPException


CONFIGURABLE_PROVIDERS = {"groq", "ollama", "bedrock", "azure"}


def is_configurable(provider: str) -> bool:
    return provider in CONFIGURABLE_PROVIDERS


def format_history(messages: list[dict]) -> tuple[str, str]:
    """Return (system_message, multi_turn_user_text) compatible with LlmChat."""
    system = next((m["content"] for m in messages if m["role"] == "system"), "")
    convo = [m for m in messages if m["role"] != "system"]
    if len(convo) <= 1:
        return system, convo[-1]["content"] if convo else ""
    # Bake prior turns into the user text so the single-turn LlmChat sees full context.
    lines = ["Previous conversation:"]
    for m in convo[:-1]:
        role = "USER" if m["role"] == "user" else "ASSISTANT"
        lines.append(f"{role}: {m['content']}")
    lines.append("")
    lines.append(f"Current message: {convo[-1]['content']}")
    return system, "\n".join(lines)


async def call_llm(provider: str, model: str, messages: list[dict]) -> dict:
    """Real LLM call via emergentintegrations. Supports multi-turn."""
    if is_configurable(provider):
        env_var = {"groq": "GROQ_API_KEY", "ollama": "OLLAMA_BASE_URL",
                   "bedrock": "AWS_ACCESS_KEY_ID", "azure": "AZURE_OPENAI_API_KEY"}[provider]
        if not os.environ.get(env_var):
            raise HTTPException(
                status_code=501,
                detail=f"Provider '{provider}' requires {env_var}. Configure the key in backend/.env or via /settings to enable live calls. It still appears in routing, analyzer and advisor based on its published pricing.",
            )
        raise HTTPException(status_code=501, detail=f"Provider '{provider}' adapter not wired in MVP.")

    from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: WPS433

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")
    system, user_text = format_history(messages)
    chat = LlmChat(
        api_key=api_key,
        session_id=str(uuid.uuid4()),
        system_message=system or "You are a helpful assistant.",
    ).with_model(provider, model)
    t0 = time.time()
    text = await chat.send_message(UserMessage(text=user_text))
    latency_ms = int((time.time() - t0) * 1000)
    return {"text": str(text), "latency_ms": latency_ms}
