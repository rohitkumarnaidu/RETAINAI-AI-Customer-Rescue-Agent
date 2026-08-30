FROM python:3.12-slim
WORKDIR /app
RUN pip install uv
COPY pyproject.toml uv.lock* README.md ./
COPY src ./src
RUN uv sync --frozen || uv sync
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "retainai.main:app", "--host", "0.0.0.0", "--port", "8000"]
