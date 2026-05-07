export const sendMessageToAI = async (message: string, mode: "chat" | "planner") => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, mode, history: [] }),
  });

  return await res.json();
};

export const getTasks = async () => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks`);
  return await res.json();
};
