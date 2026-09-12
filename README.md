# DR-app
End-to-end app providing early screening of diabetic retinopathy (DR), fully build and designed front end, AI chatbot assistance, FAQs, etc.
---

## How to run on Mac in VS Code LOCAL

### 1. Open Terminal
cd to folder

### 2. Create virtual environment
```bash
python3 -m venv .venv
```

### 3. Activate it
```bash
source .venv/bin/activate
```

You should now see `(.venv)` in the terminal.

### 4. Install packages
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Start the backend
```bash
uvicorn app:app --reload
```
(Different for mac:  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
)


### 6. Open Swagger docs
In browser open:

- http://127.0.0.1:8000/docs
- http://127.0.0.1:8000/health
- http://127.0.0.1:8000/api/model/info

### 7. UI
npx expo start once cd to frontend folder at seprate terminal

---

## How to test

### Test 1: health
In terminal:
```bash
bash tests/test_health.sh
```

Expected output example:
```json
{"status":"ok","app":"DR Screening Backend","version":"1.0.0","model_mode":"auto","quality_weights_found":false,"dr_weights_found":false}
```

### Test 2: analyze image
Put any image path you want:
```bash
bash tests/test_analyze_example.sh /Users/yourname/Desktop/sample_retina.jpg
```

Or use curl directly:
```bash
curl -X POST "http://127.0.0.1:8000/api/analyze" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/Users/yourname/Desktop/sample_retina.jpg"
```

If image quality is poor, it should reject the image.
If quality is usable or good, it returns a prediction JSON.

---

## What the endpoints do

### `GET /health`
Basic health check.

### `GET /api/model/info`
Shows whether real model weights are present.

### `POST /api/analyze`
Main endpoint.
- input: retinal image
- output: quality result + DR prediction

### `POST /api/chat/index-pdf`
Upload a PDF and index it for the later chatbot step.

### `GET /api/chat/ask?question=...`
Ask a question against the indexed PDF.


~Weights + models are not part of this repo. Too big of a file. Contact author if you wish to use model. 

## How to run 
git clone https://github.com/cause-5/DR-app.git
cd DR-app/frontend
npm install
npx expo start

https://dr-render.onrender.com/docs
