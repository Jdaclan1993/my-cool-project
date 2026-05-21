.PHONY: test lint typecheck

test:
	pytest

lint:
	ruff check .

typecheck:
	mypy .
