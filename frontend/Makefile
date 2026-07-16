# Maiat Dojo — Makefile
# Usage: make <command>
# Required: PRIVATE_KEY=0x... (set in .env or pass inline)

-include .env

# ─── Config ─────────────────────────────────────
RPC_TESTNET  = base-sepolia
RPC_MAINNET  = base
CONTRACTS    = contracts

# ─── Dev ────────────────────────────────────────
.PHONY: dev build lint

dev:                ## Start Next.js dev server
	npm run dev

build:              ## Build Next.js for production
	npm run build

lint:               ## Run linter
	npm run lint

# ─── Contracts ──────────────────────────────────
.PHONY: compile test test-v fuzz deploy-testnet deploy-mainnet interact

compile:            ## Compile Solidity contracts
	cd $(CONTRACTS) && forge build

test:               ## Run all tests (unit + fuzz)
	cd $(CONTRACTS) && forge test

test-v:             ## Run tests with verbose output
	cd $(CONTRACTS) && forge test -vvv

fuzz:               ## Run only fuzz tests
	cd $(CONTRACTS) && forge test --match-path "*.fuzz.t.sol"

deploy-testnet:     ## Deploy to Base Sepolia
	cd $(CONTRACTS) && forge script script/Deploy.s.sol --rpc-url $(RPC_TESTNET) --broadcast

deploy-mainnet:     ## Deploy to Base Mainnet (⚠️ real money)
	@echo "⚠️  Deploying to MAINNET — are you sure?"
	@read -p "Press Enter to continue, Ctrl+C to abort..."
	cd $(CONTRACTS) && forge script script/Deploy.s.sol --rpc-url $(RPC_MAINNET) --broadcast

interact:           ## Run interact script on testnet (create + buy skill)
	cd $(CONTRACTS) && forge script script/Interact.s.sol --rpc-url $(RPC_TESTNET) --broadcast

# ─── Database ───────────────────────────────────
.PHONY: db-push db-seed db-studio

db-push:            ## Push Prisma schema to DB
	npx prisma db push

db-seed:            ## Seed database with mock data
	npx prisma db seed

db-studio:          ## Open Prisma Studio (GUI)
	npx prisma studio

# ─── Audit ──────────────────────────────────────
.PHONY: slither audit

slither:            ## Run Slither static analysis
	cd $(CONTRACTS) && slither .

audit:              ## Full audit: compile + test + slither
	@echo "=== Compile ===" && cd $(CONTRACTS) && forge build
	@echo "=== Tests ===" && cd $(CONTRACTS) && forge test
	@echo "=== Slither ===" && cd $(CONTRACTS) && slither . || true
	@echo "=== Audit Complete ==="

# ─── All-in-one ─────────────────────────────────
.PHONY: setup full-testnet

setup:              ## First-time setup: install deps + compile + test
	npm install
	cd $(CONTRACTS) && forge install
	cd $(CONTRACTS) && forge build
	cd $(CONTRACTS) && forge test

full-testnet:       ## Full testnet flow: compile → test → deploy → interact
	@echo "=== Step 1: Compile ==="
	cd $(CONTRACTS) && forge build
	@echo "=== Step 2: Test ==="
	cd $(CONTRACTS) && forge test
	@echo "=== Step 3: Deploy ==="
	cd $(CONTRACTS) && forge script script/Deploy.s.sol --rpc-url $(RPC_TESTNET) --broadcast
	@echo "=== Step 4: Interact ==="
	cd $(CONTRACTS) && forge script script/Interact.s.sol --rpc-url $(RPC_TESTNET) --broadcast
	@echo "=== Done! ==="

# ─── Help ───────────────────────────────────────
.PHONY: help
help:               ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
