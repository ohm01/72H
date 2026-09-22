# Build context: repository root (see docker-compose.yml).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

# pmtiles CLI for cutting map extracts (pinned + checksum-verified).
ARG PMTILES_VERSION=1.31.2
ARG PMTILES_SHA256=f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1
ADD https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_arm64.tar.gz /tmp/pmtiles.tar.gz
RUN echo "${PMTILES_SHA256}  /tmp/pmtiles.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/pmtiles.tar.gz -C /usr/local/bin pmtiles \
    && rm /tmp/pmtiles.tar.gz

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config ./config
COPY server/app ./app
COPY server/tests ./tests

# Same uid as the host user so bind-mounted var/ stays writable without chmod 777.
RUN useradd --system --no-create-home --uid 1000 api
USER api

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers"]
