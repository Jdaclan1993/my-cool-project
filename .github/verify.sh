#!/usr/bin/env bash
set -euo pipefail

echo "=== Python Tests ==="
python -m pytest tests/ -q

echo "=== Ruff Lint ==="
ruff check .

echo "=== Mypy ==="
mypy hello.py main.py tests/

echo "=== Node Tests ==="
cd dashboard
npm test
