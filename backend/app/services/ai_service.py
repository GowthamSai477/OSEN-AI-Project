import json
from datetime import datetime

PLANORA_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "execute_planner_plan",
            "description": "Generate a goal-based plan after intake interview.",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "target": {"type": "string"},
                            "startDate": {"type": "string"},
                            "endDate": {"type": "string"},
                            "totalDays": {"type": "integer"}
                        },
                        "required": ["title", "target", "startDate", "endDate", "totalDays"]
                    },
                    "summary": {"type": "string"},
                    "dailyMealNote": {"type": ["string", "null"]},
                    "tasks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "startDate": {"type": "string"},
                                "endDate": {"type": "string"},
                                "time": {"type": "string"},
                                "durationMinutes": {"type": ["integer", "string"]},
                                "category": {"type": "string"},
                                "taskType": {"type": "string"},
                                "priority": {"type": "string"},
                                "notes": {"type": "string"}
                            },
                            "required": ["title", "startDate", "endDate", "time", "durationMinutes", "category", "taskType", "priority"]
                        }
                    },
                    "importantEvents": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "date": {"type": "string"},
                                "note": {"type": "string"}
                            },
                            "required": ["title", "date", "note"]
                        }
                    },
                    "weeklyEmailSummary": {
                        "type": "object",
                        "properties": {
                            "sendOn": {"type": "string"},
                            "sendTime": {"type": "string"},
                            "includesMissedTasks": {"type": "boolean"},
                            "includesUpcomingWeek": {"type": "boolean"}
                        },
                        "required": ["sendOn", "sendTime", "includesMissedTasks", "includesUpcomingWeek"]
                    }
                },
                "required": ["goal", "summary", "tasks", "importantEvents", "weeklyEmailSummary"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_task_range",
            "description": "Schedule new tasks (single or recurring). Max 10 per call.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "tasks": {
                        "type": "array",
                        "maxItems": 10,
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "startDate": {"type": "string"},
                                "endDate": {"type": "string"},
                                "time": {"type": "string"},
                                "durationMinutes": {"type": ["integer", "string"]},
                                "category": {"type": "string"},
                                "taskType": {"type": "string"},
                                "priority": {"type": "string"}
                            },
                            "required": ["title", "startDate", "endDate", "time", "durationMinutes", "category", "taskType", "priority"]
                        }
                    }
                },
                "required": ["summary", "tasks"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task_range",
            "description": "Delete tasks for a date range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "startDate": {"type": "string"},
                    "endDate": {"type": "string"},
                    "summary": {"type": "string"}
                },
                "required": ["startDate", "endDate", "summary"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for resources.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "display_study_resources",
            "description": "Display study resource cards.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "resources": {"type": "object"}
                },
                "required": ["topic", "resources"]
            }
        }
    }
]

def build_system_prompt(user_context: dict, intelligence_level: str = "Standard", response_style: str = "Concise") -> str:
    today_date = datetime.now().strftime("%Y-%m-%d (%A)")
    goal_str = json.dumps(user_context.get("goal")) if user_context.get("goal") else "None"
    existing_tasks = json.dumps(user_context.get("existing_tasks", []))
    
    return f"""You are Planora AI, a world-class productivity agent. Today is {today_date}.
Current Goal: {goal_str}
Existing Tasks: {existing_tasks}

Your mission is to help the user achieve their goals by managing their schedule with precision and intelligence.

CORE DIRECTIVES:
1. TOOL CALLING: You MUST use the provided tools for any schedule changes. 
2. SCHEDULING: Unless specified otherwise, schedule tasks starting from tomorrow.
3. CONFLICTS: Always check 'Existing Tasks' before scheduling. If a conflict arises, notify the user or suggest an alternative slot.
4. CONCISION: Keep your verbal responses extremely brief. Your primary value is in the actions you take.
5. TASK DETAILS: Provide meaningful titles, durations (default 30m), and appropriate categories.

TOOLS USAGE:
- `execute_task_range`: Use this for adding one or multiple tasks. 
- `delete_task_range`: Use this for removing tasks.
- `web_search`: Use this if you need external information to plan effectively (e.g., best study resources).

If the user is happy with a plan, execute it immediately. If they are unsure, offer a preview.
"""

def build_chat_prompt(user_context: dict, intelligence_level: str = "Standard", response_style: str = "Concise") -> str:
    today_date = datetime.now().strftime("%Y-%m-%d (%A)")
    return f"You are Planora Chat AI. Today is {today_date}. Be helpful and concise."

def build_study_prompt(user_context: dict, intelligence_level: str = "Standard", response_style: str = "Concise") -> str:
    today_date = datetime.now().strftime("%Y-%m-%d (%A)")
    return f"""You are Planora Study AI. Today is {today_date}.

STRICT RULE: DO NOT INVENT LINKS. Only provide links that you have verified via `web_search`. If you haven't searched yet, call `web_search` first.

1. Search for high-quality resources using `web_search`.
2. Organize results and CALL `display_study_resources` with:
   - 'youtube': [{{"title", "channel", "url", "description"}}] (ONLY REAL LINKS)
   - 'free': [{{"title", "provider", "url"}}]
   - 'premium': [{{"title", "price", "url"}}]
   - 'labs': [{{"title", "url", "description"}}]
   - 'path': [{{"week", "focus", "tasks": []}}]
3. ALWAYS call `display_study_resources` after searching.
"""
