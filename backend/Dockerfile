FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install uv
COPY backend/pyproject.toml backend/uv.lock* backend/README.md ./
COPY backend/src ./src
COPY data ./data
RUN uv sync --frozen || uv sync
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "retainai.main:app", "--host", "0.0.0.0", "--port", "8000"]
