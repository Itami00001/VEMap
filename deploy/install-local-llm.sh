#!/usr/bin/env bash
set -euo pipefail

directory=/srv/vemap-models
filename=qwen2.5-1.5b-instruct-q4_k_m.gguf
checksum=6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e
revision=91cad51170dc346986eccefdc2dd33a9da36ead9
url="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/$revision/$filename?download=true"

docker network inspect vemap-live_default >/dev/null
install -d -m 0755 "$directory"
if [[ ! -e "$directory/$filename" ]]; then
  curl -fL --proto '=https' --proto-redir '=https' --retry 3 --retry-delay 2 \
    --continue-at - --silent --show-error --output "$directory/$filename.part" "$url"
  printf '%s  %s\n' "$checksum" "$directory/$filename.part" | sha256sum -c
  mv -- "$directory/$filename.part" "$directory/$filename"
fi
printf '%s  %s\n' "$checksum" "$directory/$filename" | sha256sum -c
chmod 0644 "$directory/$filename"

if ! docker container inspect vemap-local-llm >/dev/null 2>&1; then
  image=ghcr.io/ggml-org/llama.cpp@sha256:5b43086e3ba7ea5794d72904654f6cd41224a9b1c6ac0398f4940ee380d30f23
  docker pull "$image"
  immutable=$(docker image inspect --format '{{index .RepoDigests 0}}' "$image")
  docker run --detach --name vemap-local-llm --restart unless-stopped \
    --network vemap-live_default --network-alias local-llm \
    --cpus 1 --memory 1792m --memory-swap 1792m --pids-limit 64 \
    --read-only --tmpfs /tmp:rw,nosuid,nodev,size=64m --user 65534:65534 \
    --cap-drop ALL --security-opt no-new-privileges --log-driver local \
    --mount "type=bind,src=$directory,dst=/models,readonly" \
    "$immutable" --model "/models/$filename" --alias Qwen2.5-1.5B-Instruct \
    --host 0.0.0.0 --port 8080 --threads 1 --threads-batch 1 --ctx-size 4096 --parallel 1 --no-webui
fi

for attempt in {1..60}; do
  if docker exec vemap-live-backend-1 python -c 'from urllib.request import urlopen; assert urlopen("http://local-llm:8080/health", timeout=2).status == 200' 2>/dev/null; then
    echo "Local VEMap model is healthy."
    exit 0
  fi
  sleep 2
done
docker logs --tail 30 vemap-local-llm >&2
exit 1
