# Build context: repository root (see docker-compose.yml).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

# pmtiles CLI for cutting map extracts (pinned + checksum-verified). Mac/RPi = arm64, Hetzner CX23 = amd64.
ARG PMTILES_VERSION=1.31.2
ARG TARGETARCH
RUN set -eu; \
    case "${TARGETARCH:-$(dpkg --print-architecture)}" in \
      arm64) f=Linux_arm64;  sum=f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1 ;; \
      amd64) f=Linux_x86_64; sum=3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f ;; \
      *) echo "unsupported architecture"; exit 1 ;; \
    esac; \
    python3 -c "import urllib.request,sys; urllib.request.urlretrieve(sys.argv[1], '/tmp/pmtiles.tar.gz')" \
      "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_${f}.tar.gz"; \
    echo "${sum}  /tmp/pmtiles.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/pmtiles.tar.gz -C /usr/local/bin pmtiles; \
    rm /tmp/pmtiles.tar.gz

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
