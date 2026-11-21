# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# Системные зависимости для сборки некоторых python-пакетов (scikit-learn и др.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential poppler-utils tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# AButon-8/iskra_ocr, Apache 2.0. We pin the upstream revision and check both files.
ADD --checksum=sha256:cac59e7e4b8e29de87a1ab8c831c8abff5bfc4492f137adc3bd31ec9e8bf2a13 https://raw.githubusercontent.com/AButon-8/iskra_ocr/02f34dc42af9f78d022848e83e103b182c9af134/orus.traineddata /usr/local/share/vemap/ocr/orus.traineddata
ADD --checksum=sha256:4aaf8af4a78756e28314821904e35e97b3a1dce1bf122cbaa6a5b0b694de06e0 https://raw.githubusercontent.com/AButon-8/iskra_ocr/02f34dc42af9f78d022848e83e103b182c9af134/LICENSE /usr/local/share/vemap/ocr/LICENSE
RUN chmod 0444 /usr/local/share/vemap/ocr/orus.traineddata /usr/local/share/vemap/ocr/LICENSE

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

CMD ["./entrypoint.sh"]