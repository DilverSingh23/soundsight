FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts ./scripts
# The model is public; bake it into the image so startup does not download it.
RUN python scripts/download_yamnet.py
ENV YAMNET_MODEL_DIR=/app/.models/yamnet SOUNDSIGHT_ENV=production
RUN useradd --create-home soundsight && chown -R soundsight:soundsight /app
USER soundsight
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
