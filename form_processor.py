# form_processor.py
from google.cloud import documentai_v1 as documentai
from typing import Dict
from config import GOOGLE_CLOUD_PROJECT

class FormProcessor:
    def __init__(self, project_id: str):
        self.project_id = project_id
        # Mock form definitions
        self.forms = {
            "FEMA_IA": { "fields": ["name","address","proof_of_loss","insurance_info"] },
            "FEMA_HMA": { "fields": ["project_plan","budget","eligibility"] }
        }
        self.client = documentai.DocumentProcessorServiceClient()

    def start_form(self, form_id: str) -> str:
        if form_id not in self.forms:
            return "Unknown form. Try FEMA_IA or FEMA_HMA."
        fields = ", ".join(self.forms[form_id]["fields"])
        return f"Starting {form_id}. Please provide: {fields}."

    async def process_document(self, document_path: str) -> str:
        """
        Uses Google Document AI to extract fields.
        """
        # @tweakable Update to your Document AI processor ID
        processor_id = f"projects/{self.project_id}/locations/us/processors/YOUR_PROCESSOR_ID"
        try:
            name = processor_id
            with open(document_path, "rb") as f:
                raw = f.read()
            doc = documentai.Document(raw_document=documentai.RawDocument(
                content=raw, mime_type="application/pdf"
            ))
            req = documentai.ProcessRequest(name=name, raw_document=doc.raw_document)
            result = self.client.process_document(request=req)
            data = {ent.type_: ent.mention_text for ent in result.document.entities}
            # Validate
            form_id = "FEMA_IA" if "proof_of_loss" in data else "FEMA_HMA"
            missing = [f for f in self.forms[form_id]["fields"] if f not in data]
            if missing:
                return f"Missing fields: {', '.join(missing)}."
            return f"Document processed for {form_id} successfully."
        except Exception as e:
            return f"Document AI error: {e}"