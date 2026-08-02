FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/ai-service/pyproject.toml ./
COPY apps/ai-service/src ./src

RUN pip install --no-cache-dir .

USER 65532:65532
EXPOSE 8000
CMD ["uvicorn", "rabbehni_ai.main:app", "--host", "0.0.0.0", "--port", "8000"]
