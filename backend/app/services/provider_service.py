import os
from groq import AsyncGroq
from openai import AsyncOpenAI  # DeepSeek uses OpenAI-compatible API
import json

class AIProviderService:
    def __init__(self):
        self.groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY", "dummy"))

    async def chat(self, messages: list, tools: list = None, temperature: float = 0.7, max_tokens: int = 1000):
        """
        Primary entry point for all AI calls using Groq.
        """
        try:
            return await self._call_groq(messages, tools, temperature, max_tokens)
        except Exception as groq_error:
            raise Exception(f"AI provider failed. Groq error: {groq_error}")

    async def _call_groq(self, messages, tools, temperature, max_tokens):
        # Force lower temperature for better tool-use reliability
        effective_temp = 0.1 if tools else temperature
        
        kwargs = {
            "model": "llama-3.1-8b-instant", # Optimized for speed and low latency
            "messages": messages,
            "temperature": effective_temp,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await self.groq_client.chat.completions.create(**kwargs)
        return self._parse_response(response)



    def _parse_response(self, response):
        message = response.choices[0].message
        
        # Format the output identically to what the rest of the application expects
        tool_calls = []
        if message.tool_calls:
            for tc in message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    },
                    "type": "function"
                })

        # Sanitize tool calls to ensure durationMinutes is always an integer
        for tc in tool_calls:
            try:
                args = tc["function"]["arguments"]
                if isinstance(args, str):
                    import json
                    parsed_args = json.loads(args)
                    if "tasks" in parsed_args:
                        for task in parsed_args["tasks"]:
                            if "durationMinutes" in task and isinstance(task["durationMinutes"], str):
                                try:
                                    task["durationMinutes"] = int(task["durationMinutes"])
                                except:
                                    pass
                    tc["function"]["arguments"] = json.dumps(parsed_args)
                elif isinstance(args, dict):
                    if "tasks" in args:
                        for task in args["tasks"]:
                            if "durationMinutes" in task and isinstance(task["durationMinutes"], str):
                                try:
                                    task["durationMinutes"] = int(task["durationMinutes"])
                                except:
                                    pass
            except Exception as e:
                print(f"Sanitization failed: {e}")

        return {
            "content": message.content or "",
            "tool_calls": tool_calls,
            "model_used": response.model,
        }
