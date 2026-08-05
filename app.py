from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from schemas import AnalysisResponse
from services.chat_service import SimplePdfRag
from services.dr_service import DRPredictor
from services.quality_service import QualityAssessor

app = FastAPI(title=settings.app_name, version=settings.version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

quality_assessor = QualityAssessor()
dr_predictor = DRPredictor()


@app.get('/health')
def health() -> dict:
    return {
        'status': 'ok',
        'app': settings.app_name,
        'version': settings.version,
        'model_mode': settings.model_mode,
        'quality_weights_found': settings.quality_weights.exists(),
        'dr_weights_found': settings.dr_weights.exists(),
    }


@app.get('/api/model/info')
def model_info() -> dict:
    return {
        'quality_weights': str(settings.quality_weights),
        'quality_weights_found': settings.quality_weights.exists(),
        'dr_weights': str(settings.dr_weights),
        'dr_weights_found': settings.dr_weights.exists(),
        'mode': settings.model_mode,
        'note': 'If weights are missing, the backend still runs in demo fallback mode.',
    }


@app.post('/api/analyze', response_model=AnalysisResponse)
async def analyze_retinal_image(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail='No file uploaded.')

    content_type = file.content_type or ''
    if content_type not in settings.allowed_image_types:
        raise HTTPException(status_code=400, detail=f'Unsupported file type: {content_type}')

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail='Uploaded file is empty.')
    if len(image_bytes) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f'File too large. Max is {settings.max_upload_mb} MB.')

    try:
        quality_result = quality_assessor.assess(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Could not process image for quality analysis: {exc}') from exc

    if quality_result['quality_label'] == 'reject':
        return JSONResponse(
            status_code=200,
            content={
                'success': True,
                'can_analyze': False,
                'message': 'Image quality is too poor for reliable screening. Please retake the photo.',
                'quality': quality_result,
                'prediction': None,
                'debug': {'stage': 'quality_gate'},
            },
        )

    try:
        prediction = dr_predictor.predict(image_bytes, quality_result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Could not run DR prediction: {exc}') from exc

    return {
        'success': True,
        'can_analyze': True,
        'message': 'Analysis completed.',
        'quality': quality_result,
        'prediction': prediction,
        'debug': {'stage': 'prediction_complete'},
    }


@app.post('/api/chat/index-pdf')
async def index_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail='Please upload a PDF file.')
    content = await file.read()
    with NamedTemporaryFile(delete=False, suffix='.pdf') as temp:
        temp.write(content)
        temp_path = Path(temp.name)
    result = pdf_rag.index_pdf(temp_path)
    return {'success': True, **result}

pdf_rag = None

@app.get("/api/chat/ask")
def ask_pdf(question: str):
    global pdf_rag

    if pdf_rag is None:
        pdf_rag = SimplePdfRag()

    return pdf_rag.ask(question)
