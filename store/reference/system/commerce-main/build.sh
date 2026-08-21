#!/usr/bin/env bash
set -euo pipefail

# Defaults (can be overridden with env vars or flags)
PLATFORM=${PLATFORM:-linux/amd64}
IMAGE=${IMAGE:-hatcha6/wavec}
TAG=${TAG:-v0.14}
CONTEXT=${CONTEXT:-.}
PUSH=true

usage() {
    cat <<EOF
Usage: $(basename "$0") [-p platform] [-i image] [-t tag] [-c context] [-n]
    -p platform  : target platform (default: $PLATFORM)
    -i image     : image name (default: $IMAGE)
    -t tag       : tag (default: $TAG)
    -c context   : build context (default: $CONTEXT)
    -n           : do NOT push the image
EOF
    exit 1
}

while getopts "p:i:t:c:n" opt; do
    case "$opt" in
        p) PLATFORM=$OPTARG ;;
        i) IMAGE=$OPTARG ;;
        t) TAG=$OPTARG ;;
        c) CONTEXT=$OPTARG ;;
        n) PUSH=false ;;
        *) usage ;;
    esac
done

if ! command -v docker >/dev/null 2>&1; then
    echo "Error: docker is not installed or not in PATH." >&2
    exit 2
fi

# Ensure buildx is available
if ! docker buildx version >/dev/null 2>&1; then
    echo "Error: docker buildx is not available. Ensure Docker CLI has buildx." >&2
    exit 3
fi

FULL_TAG="${IMAGE}:${TAG}"

cmd=(docker buildx build --platform "$PLATFORM" -t "$FULL_TAG")
if [ "$PUSH" = true ]; then
    cmd+=(--push)
fi
cmd+=("$CONTEXT")

echo "Running: ${cmd[*]}"
"${cmd[@]}"