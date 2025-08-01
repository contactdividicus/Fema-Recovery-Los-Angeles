# nlp_handler.py
import asyncio
from rasa.core.agent import Agent

class RasaHandler:
    def __init__(self):
        # Load your trained Rasa model
        self.agent = Agent.load("rasa_training/models")

    async def parse_intent(self, text: str) -> tuple[str, dict]:
        """
        Use Rasa to parse intent and entities.
        """
        try:
            responses = await self.agent.parse_user_message(text)
            intent = responses.get("intent", {}).get("name", "unknown")
            entities = {e["entity"]: e["value"] for e in responses.get("entities", [])}
            return intent, entities
        except Exception as e:
            print("Rasa error:", e)
            return "unknown", {}