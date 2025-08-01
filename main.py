# main.py
import asyncio
from fastapi import FastAPI, Request
from voice_handler import VoiceHandler
from form_processor import FormProcessor
from nlp_handler import RasaHandler
from fema_integration import FEMAIntegration
from config import (
    ELEVENLABS_API_KEY,
    FEMA_API_KEY,
    GOOGLE_CLOUD_PROJECT,
    TWILIO_SID,
    TWILIO_AUTH_TOKEN,
)

app = FastAPI()

class DisasterReliefChatbot:
    def __init__(self):
        self.voice_handler = VoiceHandler(
            elevenlabs_api_key=ELEVENLABS_API_KEY,
            twilio_sid=TWILIO_SID,
            twilio_auth_token=TWILIO_AUTH_TOKEN,
        )
        self.form_processor = FormProcessor(project_id=GOOGLE_CLOUD_PROJECT)
        self.nlp_handler = RasaHandler()
        self.fema_integration = FEMAIntegration(api_key=FEMA_API_KEY)
    
    async def process_user_input(self, input_type: str, user_input: str | bytes, phone_number: str = None) -> tuple[str, bytes]:
        """
        Process user input (text, audio, or SMS) and return response (text and audio).
        input_type: 'text', 'audio', or 'sms'
        user_input: raw text, raw audio bytes, or SMS content string
        phone_number: for SMS replies via Twilio
        """
        # 1. Convert to text if audio
        if input_type == "audio":
            user_text = await self.voice_handler.speech_to_text(user_input)
        else:
            user_text = user_input.decode() if isinstance(user_input, bytes) else user_input

        # 2. Intent and entities from Rasa
        intent, entities = await self.nlp_handler.parse_intent(user_text)

        # 3. Handle intents
        if intent == "start_form":
            form_id = entities.get("form_id", "FEMA_IA")
            response_text = self.form_processor.start_form(form_id)
        elif intent == "submit_document":
            doc_path = entities.get("document_path")
            response_text = await self.form_processor.process_document(doc_path)
        elif intent == "check_status":
            app_id = entities.get("application_id")
            response_text = self.fema_integration.check_application_status(app_id)
        else:
            response_text = "Sorry, I didn't understand. Could you clarify?"

        # 4. If SMS, send reply
        if input_type == "sms" and phone_number:
            await self.voice_handler.send_sms(response_text, phone_number)

        # 5. Convert text response to audio
        response_audio = await self.voice_handler.text_to_speech(response_text)
        return response_text, response_audio

# Webhook for Twilio SMS
@app.post("/webhook/twilio")
async def twilio_webhook(request: Request):
    form = await request.form()
    body = form.get("Body", "")
    from_number = form.get("From")
    bot = DisasterReliefChatbot()
    text, _ = await bot.process_user_input("sms", body, from_number)
    return {"Message": text}

# Generic processing endpoint
@app.post("/process")
async def process_input(input_type: str, user_input: str):
    bot = DisasterReliefChatbot()
    text, audio = await bot.process_user_input(input_type, user_input)
    # Save audio to file
    with open("output_audio.mp3", "wb") as f:
        f.write(audio)
    return {"text": text, "audio_file": "output_audio.mp3"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

