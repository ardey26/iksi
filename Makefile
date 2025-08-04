.PHONY: build
build:
	npx vite build
	npx vitest run --reporter=basic