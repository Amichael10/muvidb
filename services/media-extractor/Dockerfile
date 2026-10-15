FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including ffmpeg and nodejs (for yt-dlp JS challenges)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs curl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Cookies must be supplied as runtime secrets or a mounted private file.
COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
