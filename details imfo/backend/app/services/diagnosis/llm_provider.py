import asyncio
import os
from typing import Any, Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel
import openai
from openai import AsyncOpenAI

T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    """Base exception for LLM provider issues."""
    pass


class LLMConfigurationError(LLMError):
    """Raised when the LLM provider is not configured or missing an API key."""
    pass


class LLMTimeoutError(LLMError):
    """Raised when the LLM provider call times out."""
    pass


class LLMExecutionError(LLMError):
    """Raised when the LLM provider returns an API or inference error."""
    pass


class LLMProvider:
    """
    Encapsulates interaction with the OpenAI API using structured outputs.
    Ensures bounded retries, explicit timeouts, secret safety, and graceful degradation
    when API keys are unconfigured.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
    ):
        self._api_key = api_key or os.getenv("OPENAI_API_KEY", "").strip()
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    @property
    def is_configured(self) -> bool:
        """Returns True if a non-empty OpenAI API key is available."""
        key = self._api_key or os.getenv("OPENAI_API_KEY", "").strip()
        return bool(key and not key.startswith("your_"))

    def _get_client(self) -> AsyncOpenAI:
        key = self._api_key or os.getenv("OPENAI_API_KEY", "").strip()
        if not key or key.startswith("your_"):
            raise LLMConfigurationError(
                "OPENAI_API_KEY is not configured on the server. AI root-cause diagnosis is unavailable until an API key is set in backend/.env."
            )
        return AsyncOpenAI(api_key=key, timeout=self.timeout_seconds)

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
    ) -> T:
        """
        Sends structured prompts to OpenAI and parses the validated Pydantic model response.
        Applies timeout and bounded retries on transient errors.
        """
        client = self._get_client()

        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                # Use beta.chat.completions.parse for reliable structured outputs
                completion = await asyncio.wait_for(
                    client.beta.chat.completions.parse(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        response_format=response_model,
                        temperature=0.1,
                    ),
                    timeout=self.timeout_seconds,
                )
                parsed = completion.choices[0].message.parsed
                if parsed is None:
                    raise LLMExecutionError("OpenAI returned an empty or unparseable response.")
                return parsed

            except asyncio.TimeoutError as exc:
                last_error = LLMTimeoutError(
                    f"LLM request timed out after {self.timeout_seconds}s (attempt {attempt + 1}/{self.max_retries + 1})."
                )
            except openai.RateLimitError as exc:
                last_error = LLMExecutionError(f"OpenAI rate limit exceeded: {str(exc)}")
                if attempt < self.max_retries:
                    await asyncio.sleep(1.0 * (attempt + 1))
            except openai.AuthenticationError as exc:
                raise LLMConfigurationError(f"OpenAI authentication failed: {str(exc)}")
            except openai.APIError as exc:
                last_error = LLMExecutionError(f"OpenAI API error: {str(exc)}")
                if attempt < self.max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
            except Exception as exc:
                last_error = LLMExecutionError(f"Unexpected error communicating with OpenAI: {str(exc)}")
                break

        if isinstance(last_error, LLMError):
            raise last_error
        raise LLMExecutionError(f"Failed to generate structured diagnosis after {self.max_retries + 1} attempts: {last_error}")
