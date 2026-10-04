# Digital Macaroni demo voice service (Cloud Run): Python, Google ADK, Gemini Live.
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
ENV PATH="/app/.venv/bin:$PATH"
RUN useradd --system --no-create-home demo
USER demo
# No access log: browser socket URLs carry the session token. 256 KB frames, like the old service.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --no-access-log --ws-max-size 262144 --proxy-headers --forwarded-allow-ips='*'"]
