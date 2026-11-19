#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

root=${VEMAP_DEPLOY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
cd "$root"
project=${VEMAP_PROJECT_NAME:-vemap-live}
registry=ghcr.io/itami00001/vemap
origin=${VEMAP_ORIGIN_URL:-http://127.0.0.1:15173}
state="$root/.deploy-state"
backups=${VEMAP_BACKUP_DIR:-"$HOME/projects/vemap-db-backups"}
mkdir -p "$state" "$backups"
exec 9>"$state/rollout.lock"
flock -n 9 || { echo 'A VEMap rollout is already running.' >&2; exit 1; }

base=(docker compose --project-name "$project" -f "$root/docker-compose.yml"
  -f "$root/deploy/compose.production.yml")
if [[ -f "$root/compose.production.yml" ]]; then
  base+=(-f "$root/compose.production.yml")
fi
images=("${base[@]}" -f "$root/deploy/compose.images.yml")

write_pair() {
  local path=$1 temporary
  temporary=$(mktemp "$state/.pair-XXXXXX")
  printf '%s\n' "$2" "$3" > "$temporary"
  mv -f -- "$temporary" "$path"
}

backup_database() {
  local stamp temporary dump
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  temporary=$(mktemp "$backups/.dump-XXXXXX")
  if ! "${base[@]}" exec -T postgres sh -ec 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$temporary" ||
     ! "${base[@]}" exec -T postgres pg_restore --file=/dev/null < "$temporary"; then
    rm -f -- "$temporary"
    return 1
  fi
  dump="$backups/$project-$stamp-${temporary##*-}.dump"
  mv -- "$temporary" "$dump"
  (cd "$backups" && sha256sum "${dump##*/}" > "${dump##*/}.sha256")
  printf 'Verified PostgreSQL backup: %s\n' "$dump"
}

smoke_test() {
  local attempt page
  for attempt in {1..15}; do
    if page=$(curl -fsS --max-time 5 "$origin/") && [[ "$page" == *'<div id="root">'* ]] &&
       curl -fsS --max-time 5 "$origin/api/periods" |
         python3 -c 'import json,sys; rows=json.load(sys.stdin); sys.exit(not isinstance(rows,list) or not rows)' 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo 'VEMap failed the local HTTP smoke test.' >&2
  return 1
}

apply_images() {
  VEMAP_BACKEND_IMAGE=$1 VEMAP_FRONTEND_IMAGE=$2 "${images[@]}" up --detach --no-build \
    --pull never --no-deps --force-recreate --wait --wait-timeout 120 backend frontend && smoke_test
}

running_image() {
  local container
  container=$("${base[@]}" ps -q "$1")
  [[ -n "$container" ]] || { echo "No running $1 container in project $project." >&2; return 1; }
  docker inspect --format '{{.Image}}' "$container"
}

read_promotion() {
  local endpoint tag
  endpoint=https://api.github.com/repos/Itami00001/VEMap/releases/latest
  tag=$(curl -fsS --proto '=https' --max-time 20 "$endpoint" | python3 -c 'import json,sys; print(json.load(sys.stdin)["tag_name"])') || return 1
  if [[ ! "$tag" =~ ^deploy-[0-9a-f]{40}-[0-9]+-[0-9]+$ ]]; then
    return 0
  fi
  curl -fsSL --proto '=https' --proto-redir '=https' --max-time 30 \
    "https://github.com/Itami00001/VEMap/releases/download/$tag/vemap-production.json" |
    python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["backend"],data["frontend"],sep="\n")'
}

case ${1:-} in
  --rollback)
    [[ $# == 1 && -s "$state/previous" ]] || { echo 'No saved image pair for rollback.' >&2; exit 1; }
    mapfile -t previous < "$state/previous"
    backup_database
    apply_images "${previous[0]}" "${previous[1]}"
    exit
    ;;
  --follow)
    [[ $# == 1 ]] || exit 2
    promotion=$(read_promotion)
    [[ -n "$promotion" ]] || exit 0
    if [[ -f "$state/attempted" && "$promotion" == "$(<"$state/attempted")" ]]; then
      exit 0
    fi
    mapfile -t promoted <<< "$promotion"
    set -- "${promoted[@]}"
    ;;
esac

backend_prefix="$registry-backend@sha256:"
frontend_prefix="$registry-frontend@sha256:"
if [[ $# != 2 || "$1" != "$backend_prefix"* || ! "${1#"$backend_prefix"}" =~ ^[0-9a-f]{64}$ ||
               "$2" != "$frontend_prefix"* || ! "${2#"$frontend_prefix"}" =~ ^[0-9a-f]{64}$ ]]; then
  echo 'Usage: bash deploy/rollout.sh BACKEND_DIGEST_REF FRONTEND_DIGEST_REF | --follow | --rollback' >&2
  exit 2
fi

old_backend=$(running_image backend)
old_frontend=$(running_image frontend)
docker pull "$1"
docker pull "$2"
if [[ "$(docker image inspect --format '{{.Id}}' "$1")" == "$old_backend" &&
      "$(docker image inspect --format '{{.Id}}' "$2")" == "$old_frontend" ]]; then
  smoke_test
  write_pair "$state/attempted" "$1" "$2"
  exit
fi

backup_database
rollback_backend="vemap-rollback-backend:${old_backend#sha256:}"
rollback_frontend="vemap-rollback-frontend:${old_frontend#sha256:}"
docker image tag "$old_backend" "$rollback_backend"
docker image tag "$old_frontend" "$rollback_frontend"
write_pair "$state/previous" "$rollback_backend" "$rollback_frontend"
write_pair "$state/attempted" "$1" "$2"

if ! apply_images "$1" "$2"; then
  echo 'Rollout failed. Restoring the previous app images.' >&2
  if ! apply_images "$rollback_backend" "$rollback_frontend"; then
    echo 'Automatic image rollback failed. Inspect the service logs.' >&2
  fi
  exit 1
fi
printf 'VEMap is running %s and %s\n' "$1" "$2"
