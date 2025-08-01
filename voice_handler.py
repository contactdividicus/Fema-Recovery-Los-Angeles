# voice_handler.py
import asyncio
from elevenlabs import AsyncElevenLabs, VoiceSettings
from twilio.rest import Client
from config import (ELEVENLABS_API_KEY, TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)

class VoiceHandler:
    def __init__(self, elevenlabs_api_key: str, twilio_sid: str, twilio_auth_token: str):
        self.elevenlabs = AsyncElevenLabs(api_key=elevenlabs_api_key)
        self.twilio = Client(twilio_sid, twilio_auth_token)

    async def text_to_speech(self, text: str, voice_id: str = "Rachel") -> bytes:
        """
        Convert text to speech via ElevenLabs.
        Returns MP3 bytes.
        """
        # @tweakable Controls speech stability (0.0–1.0)
        stability = 0.7
        # @tweakable Controls how closely voice matches training
        similarity_boost = 0.7
        # @tweakable Style/emotion of the voice (0.0–1.0)
        style = 0.2

        try:
            response = await self.elevenlabs.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                voice_settings=VoiceSettings(
                    stability=stability,
                    similarity_boost=similarity_boost,
                    style=style,
                    use_speaker_boost=True
                ),
                output_format="mp3_44100_128"
            )
            audio = b""
            async for chunk in response:
                audio += chunk
            return audio
        except Exception as e:
            print("TTS error:", e)
            return b""

    async def speech_to_text(self, audio_data: bytes) -> str:
        """
        Convert audio to text (placeholder for real STT).
        """
        # TODO: Integrate OpenAI Whisper or Google STT
        return "Transcription placeholder."

    async def send_sms(self, message: str, to: str):
        """
        Send an SMS via Twilio.
        """
        try:
            self.twilio.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=to
            )
        except Exception as e:
            print("SMS send error:", e)

