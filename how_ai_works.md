# How the AI Works in Planora

When a user interacts with Planora, a highly orchestrated sequence of events occurs under the hood. Planora isn't just a simple chatbot; it acts as an intelligent agent capable of reading database context, reasoning about a user's schedule, and independently executing database operations to manage their life.

Here is a detailed breakdown of how the AI works after fetching data, and the key files that make this magic happen.

---

## 1. The Core AI Flow (Step-by-Step)

When a user sends a message (e.g., "Schedule study sessions for 2 hours every evening this week"):

1.  **Request Reception (`routers/ai.py`)**: The backend receives the request at the `/api/ai/chat` endpoint.
2.  **Context Fetching**: The backend queries the database for the user's current state:
    *   Their overall `Goal` and `Constraints`.
    *   Their existing `DailyTask` schedule (everything from today onwards).
    *   Their previous chat history (`ChatSession` and `ChatMessage`).
3.  **Prompt Engineering (`services/ai_service.py`)**: The system injects this real-time user data into a massive "System Prompt." This prompt gives the AI strict rules on how to act (e.g., "never schedule tasks during sleep hours", "redistribute missed tasks").
4.  **LLM Execution (`services/provider_service.py`)**: The fully built prompt, along with the user's message and available "Tools" (JSON schemas of functions the AI can call), is sent to the LLM provider (like Groq or DeepSeek).
5.  **AI Decision Making**: The AI processes the request. It can respond in two ways:
    *   **Text Response**: Just talking back to the user.
    *   **Tool Call**: Deciding it needs to modify the database. It outputs a structured JSON object requesting to run a specific function (e.g., `execute_task_range`).
6.  **Tool Execution (`services/tool_executor.py`)**: If the AI returns a tool call, the backend automatically intercepts it and runs the corresponding Python function. This function modifies the Supabase database (adding, updating, or deleting tasks).
7.  **Response Delivery**: The final text message from the AI, along with the status of any executed actions, is saved to the database and sent back to the frontend to update the UI.

---

## 2. Key Files and Their Functions

The AI architecture in Planora is split across several specific files to keep the logic clean and maintainable.

### `backend/app/routers/ai.py`
**The Conductor**
This is the entry point for AI operations. Its main functions are:
*   Authenticating the user via Clerk.
*   Fetching the user's context (goals, constraints, existing tasks) from the database to ensure the AI knows what the user's current schedule looks like.
*   Determining whether the user is in "Planner Mode" (which allows tool execution) or "Chat Mode" (just conversation).
*   Routing the assembled prompt to the provider service and waiting for a response.
*   Checking if the AI requested any "Tool Calls" and, if so, routing them to the tool executor.
*   Saving the final conversation state (user message, assistant message, and actions taken) back to the database.

### `backend/app/services/ai_service.py`
**The Brain's Instructions**
This file does not talk to the database or the API directly; instead, it defines *how the AI should think*.
*   **`PLANORA_TOOLS`**: Defines the JSON schema for the tools the AI is allowed to use. It tells the AI exactly what arguments it needs to provide to trigger actions like `execute_planner_plan`, `execute_task_range`, and `delete_task_range`.
*   **`build_system_prompt()`**: This function generates the massive rulebook for the AI. It handles embedding the user's context, the current date, and enforcing rules like "Type A goals vs. Type B tasks", how to calculate weight loss, how to redistribute missed tasks, and how to format output. 

### `backend/app/services/provider_service.py`
**The Communicator** *(Referenced by `ai.py`)*
This file manages the actual network requests to the external LLM providers (e.g., Groq, DeepSeek). 
*   It abstracts away the API details.
*   It handles formatting the messages array and attaching the tool definitions so the external provider understands them.
*   It handles error management (like rate limits or timeouts) from the AI models.

### `backend/app/services/tool_executor.py`
**The Hands** *(Referenced by `ai.py`)*
When the AI decides to "do something" (like schedule a task), it just outputs text (JSON). This file turns that text into reality.
*   It contains the actual Python functions that map to the AI's tool calls (e.g., a function to handle `execute_task_range`).
*   It parses the JSON arguments provided by the AI.
*   It uses SQLAlchemy to perform the actual `INSERT`, `UPDATE`, or `DELETE` operations on the PostgreSQL database.
*   It handles conflict resolution (e.g., what to do if the AI tries to schedule a task at a time that is already booked).

---

## Summary
The AI works by combining **Dynamic Context Injection** (fetching the DB state before every message) with **Function Calling** (allowing the AI to output structured data instead of just text). This allows Planora to act as a fully autonomous agent that manages the user's database records on their behalf.
