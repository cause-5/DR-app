from __future__ import annotations

import os
from pathlib import Path
from typing import Any
import re

from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import groq
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from spellchecker import SpellChecker

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1500,
    chunk_overlap=200
)
load_dotenv()
pdf_path = Path("chatbot/DR.pdf")

class SimplePdfRag:
    def __init__(self) -> None:
        self.chunks: list[str] = []
        self.vectorizer = TfidfVectorizer(stop_words='english')
        self.vectors = None
        self.spell = SpellChecker()

        self.client = groq.Groq(api_key=os.environ.get("GROQ_API_KEY"))

        pdf_path = Path("chatbot/DR.pdf")
        if not pdf_path.exists():
            pdf_path = Path("DR.pdf")

        if pdf_path.exists():
            self.index_pdf(pdf_path)

    def _preprocess_question(self, question: str) -> str:
        replacements = {
            r'\bkw\b': 'Kitchener Waterloo',
            r'\bkwc\b': 'Kitchener, Waterloo, Cambridge',
            r'\bdr\b': 'Diabetic Retinopathy',
        }
        processed = question
        for pattern, replacement in replacements.items():
            processed = re.sub(pattern, replacement, processed, flags=re.IGNORECASE)
            
        words = processed.split()
        corrected_words = []
        for word in words:
            clean_word = re.sub(r'[^a-zA-Z]', '', word)
            if clean_word:
                corrected = self.spell.correction(clean_word)
                if corrected and corrected.lower() != clean_word.lower():
                    word = word.replace(clean_word, corrected)
            corrected_words.append(word)
            
        return ' '.join(corrected_words)

    def index_pdf(self, pdf_path: str | Path, chunk_size: int = 1500) -> dict[str, Any]:
        reader = PdfReader(str(pdf_path))
        text = ""

        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            print(f"Page {i+1}: {len(page_text)} characters")
            text += page_text + "\n"
            text = ' '.join(text.split())
        self.chunks = splitter.split_text(text)
        if self.chunks:
            self.vectors = self.vectorizer.fit_transform(self.chunks)
        print("Total text length:", len(text))
        print("Chunks:", len(self.chunks))
        return {'indexed': True, 'chunks': len(self.chunks)}

    def ask(self, question: str, top_k: int = 3) -> dict[str, Any]:
        if not self.chunks or self.vectors is None:
            return {'answer': 'No PDF indexed yet.', 'sources': []}

        corrected_question = self._preprocess_question(question)
        q_vec = self.vectorizer.transform([corrected_question])
        sims = cosine_similarity(q_vec, self.vectors).flatten()

        top_indices = sims.argsort()[-top_k:][::-1]
        top_chunks = [self.chunks[i] for i in top_indices if sims[i] > 0]

        if not top_chunks:
            return {'answer': 'I could not find relevant information to answer your question.', 'sources': []}

        context = "\n\n".join(top_chunks)
        prompt = f"""You are a helpful, professional medical AI assistant specialized in Diabetic Retinopathy.
Use the following context from an educational PDF to answer the user's question.
Be empathetic, concise, and trustworthy. Do NOT give official medical diagnoses.

Context:
{context}

User Question: {corrected_question}
Answer:"""

        try:
            response = self.client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[{"role": "system", "content": prompt}]
            )
            answer = response.choices[0].message.content
        except Exception as e:
            answer = f"Sorry, I encountered an error while connecting to the AI: {e}"

        return {'answer': answer, 'sources': top_chunks}

reader = PdfReader(str(pdf_path))

print("Pages:", len(reader.pages))

for i, page in enumerate(reader.pages):
    txt = page.extract_text() or ""
    print(i, len(txt))
