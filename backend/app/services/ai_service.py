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
    
    return f"""You are Planora AI. Today is {today_date}.
Goal: {goal_str}
IMPORTANT: Use the tool-calling interface ONLY. DO NOT output tags like <function=...> in your text.
Rules:
1. Schedule from tomorrow unless asked for today.
2. Max 10 tasks per tool call.
3. Use execute_task_range for adding, delete_task_range for deleting.
4. Be extremely concise.
"""

def build_chat_prompt(user_context: dict, intelligence_level: str = "Standard", response_style: str = "Concise") -> str:
    today_date = datetime.now().strftime("%Y-%m-%d (%A)")
    return f"You are Planora Chat AI. Today is {today_date}. Be helpful and concise."

def build_study_prompt(user_context: dict, intelligence_level: str = "Standard", response_style: str = "Concise") -> str:
    today_date = datetime.now().strftime("%Y-%m-%d (%A)")
    return f"""You are Planora Study AI. Today is {today_date}.
1. Search for high-quality resources using `web_search`.
2. Organize results and CALL `display_study_resources` with:
   - 'youtube': [{{"title", "channel", "url", "description"}}]
   - 'free': [{{"title", "provider", "url"}}]
   - 'premium': [{{"title", "price", "url"}}]
   - 'labs': [{{"title", "url", "description"}}]
   - 'path': [{{"week", "focus", "tasks": []}}]
3. ALWAYS call `display_study_resources` after searching.
"""
