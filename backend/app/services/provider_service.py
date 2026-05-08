import os
import json
import google.generativeai as genai
from groq import AsyncGroq
from openai import AsyncOpenAI

class AIProviderService:
    def __init__(self):
        self.groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY", "dummy"))
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)

    async def chat(self, messages: list, tools: list = None, temperature: float = 0.7, max_tokens: int = 1000, provider: str = "groq"):
        """
        Primary entry point for AI calls. Default is Groq.
        """
        if provider == "gemini" and self.gemini_key:
            return await self._call_gemini(messages, temperature, max_tokens)
        
        try:
            return await self._call_groq(messages, tools, temperature, max_tokens)
        except Exception as groq_error:
            raise Exception(f"AI provider failed. Groq error: {groq_error}")

    async def _call_gemini(self, messages, temperature, max_tokens):
        """
        Calls Google Gemini API.
        """
        system_instruction = None
        gemini_history = []
        
        # Extract system instruction and build proper history
        for msg in messages[:-1]:
            if msg["role"] == "system":
                # Combine multiple system messages if they exist
                if system_instruction:
                    system_instruction += "\n\n" + msg["content"]
                else:
                    system_instruction = msg["content"]
            else:
                role = "user" if msg["role"] == "user" else "model"
                gemini_history.append({"role": role, "parts": [msg["content"]]})
        
        last_msg = messages[-1]
        if last_msg["role"] == "system":
            if system_instruction:
                system_instruction += "\n\n" + last_msg["content"]
            else:
                system_instruction = last_msg["content"]
            last_message = "Please proceed."
        else:
            last_message = last_msg["content"]
            
        # Use the 2.5 flash model to avoid severe rate limits on experimental models
        model_name = 'gemini-2.5-flash'
        
        if system_instruction:
            model = genai.GenerativeModel(model_name, system_instruction=system_instruction)
        else:
            model = genai.GenerativeModel(model_name)
        
        try:
            chat = model.start_chat(history=gemini_history)
            response = await chat.send_message_async(
                last_message,
                generation_config=genai.types.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
            )
            
            return {
                "content": response.text,
                "tool_calls": [],
                "model_used": model_name,
            }
        except Exception as e:
            error_str = str(e)
            if "Resource has been exhausted" in error_str or "quota" in error_str.lower():
                raise Exception("AI Rate Limit Exceeded: You have made too many requests to the Gemini API recently. Please wait a moment and try again.")
            raise Exception(f"AI Provider Error: {error_str}")

    async def _call_groq(self, messages, tools, temperature, max_tokens):
        # Force lower temperature for better tool-use reliability
        effective_temp = 0.1 if tools else temperature
        
        kwargs = {
            "model": "llama-3.1-8b-instant",
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

        for tc in tool_calls:
            try:
                args = tc["function"]["arguments"]
                if isinstance(args, str):
                    parsed_args = json.loads(args)
                    if "tasks" in parsed_args:
                        for task in parsed_args["tasks"]:
                            if "durationMinutes" in task and isinstance(task["durationMinutes"], str):
                                try:
                                    task["durationMinutes"] = int(task["durationMinutes"])
                                except:
                                    pass
                    tc["function"]["arguments"] = json.dumps(parsed_args)
            except Exception as e:
                print(f"Sanitization failed: {e}")

        return {
            "content": message.content or "",
            "tool_calls": tool_calls,
            "model_used": response.model,
        }
