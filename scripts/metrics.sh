#!/usr/bin/env bash
# Effort / reuse metrics from package boundaries. See METRICS.md.
#
#   scripts/metrics.sh            # buckets + per-tool reuse ratio for the working tree
#   scripts/metrics.sh --commits  # also: per-commit LOC attribution (platform vs tool)
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_GLOB='\.(py|ts|tsx|mjs|css|yaml|yml|json|html|mako|ini|toml|sh)$'
EXCLUDE='(node_modules/|/dist/|pnpm-lock\.yaml|/generated/|schema/tool-config\.schema\.json|__pycache__)'

tracked() { git ls-files -- "$@" | grep -E "$SRC_GLOB" | grep -Ev "$EXCLUDE" || true; }
loc()     { local files; files=$(tracked "$@"); [ -n "$files" ] && echo "$files" | xargs cat | wc -l || echo 0; }
nfiles()  { tracked "$@" | wc -l; }

PLATFORM_PATHS=(packages platform db/alembic/versions/0001_platform_shared.py db/alembic/env.py db/alembic.ini db/alembic/script.py.mako services/auth apps/shell scripts Dockerfile.python docker-compose.yml Makefile turbo.json package.json pnpm-workspace.yaml tsconfig.base.json requirements-dev.txt ruff.toml)
tool_paths() { echo "apps/$1 services/$1 db/alembic/versions/*_$1.py"; }

P_LOC=$(loc "${PLATFORM_PATHS[@]}"); P_FILES=$(nfiles "${PLATFORM_PATHS[@]}")
printf '%-10s %8s %6s\n' bucket loc files
printf '%-10s %8d %6d\n' platform "$P_LOC" "$P_FILES"

for tool in kyc refunds flags; do
  # shellcheck disable=SC2046
  T_LOC=$(loc $(tool_paths "$tool")); T_FILES=$(nfiles $(tool_paths "$tool"))
  printf '%-10s %8d %6d\n' "$tool" "$T_LOC" "$T_FILES"
done

echo
echo "reuse ratio = platform / (platform + tool)"
for tool in kyc refunds flags; do
  # shellcheck disable=SC2046
  T_LOC=$(loc $(tool_paths "$tool"))
  awk -v p="$P_LOC" -v t="$T_LOC" -v n="$tool" 'BEGIN { printf "%-10s tool=%d  reuse=%.3f\n", n, t, p / (p + t) }'
done

if [ "${1:-}" = "--commits" ]; then
  echo
  echo "per-commit attribution (added+deleted lines, tracked source only)"
  git log --reverse --format='%h %s' | while read -r sha subject; do
    git show --numstat --format='' "$sha" | grep -E "$SRC_GLOB" | grep -Ev "$EXCLUDE" \
      | awk -v sha="$sha" -v subj="$subject" '
        { n = $1 + $2; f = $3
          if (f ~ /^(apps|services)\/(kyc|refunds|flags)\// || f ~ /versions\/[0-9]+_(kyc|refunds|flags)\.py$/) tool += n
          else if (f ~ /\.md$/) doc += n
          else plat += n }
        END { printf "%s  platform=%-6d tool=%-6d  %s\n", sha, plat, tool, subj }'
  done
fi
