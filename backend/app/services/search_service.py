import os
import httpx
import json

class SearchService:
    def __init__(self):
        self.serpapi_key = os.getenv("SERPAPI_KEY")
        self.brave_key = os.getenv("BRAVE_SEARCH_API_KEY")

    async def search(self, query: str):
        """
        Searches the web using available API keys.
        Falls back to a mock if no keys are provided.
        """
        if self.serpapi_key:
            return await self._search_serpapi(query)
        elif self.brave_key:
            return await self._search_brave(query)
        else:
            # Fallback to a mock or generic response for demo purposes
            # In a real app, you'd want to use a free search API or scraper
            print("No search API key found. Using mock results.")
            return self._mock_results(query)

    async def _search_serpapi(self, query: str):
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    "engine": "google",
                    "q": query,
                    "api_key": self.serpapi_key
                }
                response = await client.get("https://serpapi.com/search", params=params)
                data = response.json()
                
                results = []
                if "organic_results" in data:
                    for res in data["organic_results"][:8]:
                        results.append({
                            "title": res.get("title"),
                            "link": res.get("link"),
                            "snippet": res.get("snippet")
                        })
                return results
        except Exception as e:
            print(f"SerpAPI search failed: {e}")
            return []

    async def _search_brave(self, query: str):
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Accept": "application/json", "X-Subscription-Token": self.brave_key}
                params = {"q": query}
                response = await client.get("https://api.search.brave.com/res/v1/web/search", headers=headers, params=params)
                data = response.json()
                
                results = []
                if "web" in data and "results" in data["web"]:
                    for res in data["web"]["results"][:8]:
                        results.append({
                            "title": res.get("title"),
                            "link": res.get("url"),
                            "snippet": res.get("description")
                        })
                return results
        except Exception as e:
            print(f"Brave search failed: {e}")
            return []

    def _mock_results(self, query: str):
        """
        Provides high-quality, real search fallback URLs to avoid hallucinations.
        """
        topic = query.lower()
        
        # Priority for educational topics
        is_educational = any(k in topic for k in ["learn", "how to", "course", "tutorial", "guide", "study", "what is"])
        
        # Construct real search URLs
        yt_search = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
        g_search = f"https://www.google.com/search?q={query.replace(' ', '+')}"
        
        if "cyber security" in topic:
            return [
                {"title": "NetworkChuck Cyber Security Full Course", "link": yt_search, "snippet": "Click here to see real, current Cyber Security courses on YouTube."},
                {"title": "TryHackMe - Learning Paths", "link": "https://tryhackme.com/paths", "snippet": "Interactive hands-on labs for cybersecurity learning."},
                {"title": "OWASP Top 10 Project", "link": "https://owasp.org/www-project-top-ten/", "snippet": "The industry standard for web security vulnerabilities."},
                {"title": "Coursera - Google Cybersecurity Certificate", "link": "https://www.coursera.org/google-cybersecurity", "snippet": "Professional certification for entering the field."}
            ]
        elif "python" in topic or "aiml" in topic or "machine learning" in topic:
            return [
                {"title": f"Top {query.upper()} Courses on YouTube", "link": yt_search, "snippet": "Real-time search results for the best video tutorials on this topic."},
                {"title": "FreeCodeCamp - Scientific Computing & AI", "link": "https://www.freecodecamp.org/learn/", "snippet": "Free certifications and hands-on coding projects."},
                {"title": "Coursera - AI For Everyone (DeepLearning.AI)", "link": "https://www.coursera.org/learn/ai-for-everyone", "snippet": "A great starting point for understanding AI and ML concepts."},
                {"title": "Kaggle - Machine Learning Courses", "link": "https://www.kaggle.com/learn", "snippet": "Practical, hands-on ML and data science tutorials."}
            ]
        else:
            # Safe, functional fallback to real search results
            return [
                {"title": f"YouTube: {query}", "link": yt_search, "snippet": "Find top video guides and tutorials for this topic."},
                {"title": f"Google Search: {query}", "link": g_search, "snippet": "Browse the web for documentation, articles, and courses."}
            ]
