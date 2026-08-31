# Bristol & Clifton G — a static React site.
#
# `make check` is what CI runs; if it passes locally the deploy will too.

.DEFAULT_GOAL := help
.PHONY: help install dev build preview check ci test typecheck format format-check clean distclean

help: ## Show this help
	@echo "Bristol & Clifton G — make targets"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Run the dev server
	npm run dev

build: ## Build the static site into dist/
	npm run build

preview: build ## Serve the built site locally
	npm run preview

check: typecheck format-check test ## Everything CI runs
ci: check ## Alias for check

test: ## Run the test suite
	npm run test

typecheck: ## Typecheck the app
	npm run typecheck

format: ## Format everything with prettier
	npm run format

format-check: ## Fail if anything is unformatted
	npm run format:check

clean: ## Remove build output
	rm -rf dist

distclean: clean ## Also remove installed dependencies
	rm -rf node_modules
