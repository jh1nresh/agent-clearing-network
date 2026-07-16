# Agent Reputation Clearing Network — Solana MVP Spec

> Date: 2026-04-23
> Deadline: 2026-05-11 (Colosseum Frontier submission)
> Team: JhiNResH (Backend/Anchor) + Claude (Product/Frontend co-builder)
> Source plan: `~/Downloads/Colosseum_Frontier_規劃書_v2.docx`

## 1. One-liner
**Stripe for AI agents** — agent 經濟的信用清算層。Agent 跨 marketplace 的 reputation 可攜。

## 2. Non-goals (this MVP)
- Mainnet deploy（devnet only，除非 5/9 前穩）
- Arcade token / protocol token
- Multi-sig Evaluator（LLM-Judge single-sig 即可）
- Reputation NFT（Token-2022）
- 真正跨鏈（BSC Maiat 不接）

## 3. Architecture

### 3.1 Layers
```
Partner Marketplaces (2 demo UIs: UI-A, UI-B)
        ↓
Clearing Network (this project)
  ├─ Agent Registry Program
  ├─ Skill Listing Program
  ├─ Job Escrow Program        ── CPI ──▶ Reputation Ledger Program
  └─ Settlement Router (TS off-chain)
        ↓
Payment Rails: x402 on Solana · 原生 SPL 轉帳
        ↓
Solana L1 (Anchor + PDAs)
```

### 3.2 Four Anchor Programs

| Program | PDA seeds | Key fields | Writer |
|---|---|---|---|
| **Agent Registry** | `[b"agent", owner]` | agent_id, metadata_uri, owner | anyone (self-register) |
| **Skill Listing** | `[b"skill", provider_agent, skill_id]` | endpoint_uri, price, min_reputation, accepted_rails | provider agent |
| **Job Escrow** | `[b"job", client, nonce]` | state machine, evaluator, USDC vault (ATA owned by job PDA) | client funds, evaluator resolves |
| **Reputation Ledger** | `[b"reputation", agent]` | completion_count, dispute_count, total_volume_settled, avg_latency, tier | **ONLY Escrow via CPI** (has_one + signer constraint) |

### 3.3 Job state machine
```
Open → Funded → Submitted → Completed
                         ↘ Rejected
                         ↘ Expired
```
- Funded: client deposits USDC into job vault (ATA owned by job PDA authority)
- Submitted: provider delivers off-chain result, posts ref on-chain
- Completed: evaluator signs approval → Escrow CPI writes Reputation → vault → provider
- Rejected/Expired: refund to client (no rep write)

### 3.4 Reputation → Routing (核心差異化)

| Reputation | 驗收 | 結算速度 | 軌道 |
|---|---|---|---|
| > 200 | Auto-approve | 即時 | 可後付 (MPP) |
| 50-200 | LLM-as-Judge | < 30s | 標準 x402 |
| < 50 | 嚴格驗收 + 多簽 | 較慢 | 預付 x402 |

Settlement Router (off-chain TS) 讀 `reputation PDA` → 選軌道。

## 4. Stack

| 層 | 選擇 |
|---|---|
| 鏈 | Solana devnet → mainnet-beta (optional) |
| 合約 | Anchor 0.31+ |
| 前端 | Next.js 14 + Tailwind + wallet-adapter |
| Indexer | Helius Webhooks + Postgres |
| Agent 框架 | LangChain + OpenAI (LLM-Judge 共用) |
| 支付 | x402 on Solana (use existing facilitator) |

## 5. 18-Day Timeline

### Week 1: 4/23 - 4/29 — Foundation
- **4/23-24**: Repo + CI + devnet wallet + Anchor workspace 骨架 + schema/PDA 對齊定稿
- **4/25-27**:
  - JhiN: Agent Registry + Skill Listing programs (anchor test 綠)
  - Claude: Next.js 骨架 + wallet adapter + UI-A 雛形 + agent registration 頁面
- **4/28-29**:
  - JhiN: Job Escrow program（最難部分）
  - Claude: 3 個 demo agents (Research / Translate / Analyze) 本地可跑 + x402 client

**Checkpoint 4/29**: devnet 能註冊 agent、掛 skill、跑一次 x402 付款、tx signature on-chain。

### Week 2: 4/30 - 5/6 — Core logic
- **4/30-5/1**: Reputation Ledger + Escrow→Reputation CPI 寫入路徑（含安全測試）/ UI-A 完整 flow
- **5/2-3**: Settlement Router / UI-B（第二個視覺完全不同的 marketplace）
- **5/4-5**: LLM-as-Judge oracle (Python + OpenAI, signed output) / Mock DeFi 整合頁（reputation-gated rate）
- **5/6**: 全員聯調 + bug fix + devnet 穩定

**Checkpoint 5/6**: UI-A 做一筆 escrow job → 切到 UI-B → 信用分同 wallet 顯示。

### Week 3: 5/7 - 5/11 — Polish + Pitch
- **5/7**: Mainnet-beta deploy (optional) + technical writeup / Pitch deck (10 頁)
- **5/8**: Pitch video 拍攝 first cut
- **5/9**: Video 修剪 + README + archive demo 素材
- **5/10**: **Buffer day — NO NEW FEATURES**，只做 polish + 壓測 + 提交預演
- **5/11**: 最終提交（Colosseum + GitHub + video link），留 4hr buffer

## 6. Scope 裁切優先序
1. **Must**: Agent Registry, Skill Listing, Job Escrow, Reputation Ledger, UI-A, 1 demo agent, x402
2. **Should**: UI-B, LLM-Judge oracle, 3 demo agents, Settlement Router
3. **Nice**: Mainnet, DeFi integration mock, multisig Evaluator, Reputation NFT

## 7. Risks
| 風險 | 應對 |
|---|---|
| Anchor/Rust 經驗 | 前 3 天跑 Anchor book + solana-developers escrow tutorial。4 個 program 從 Anchor examples 起，不從零寫。|
| 時程飆車 | 嚴格按 scope 優先序裁切。5/10 絕不加新功能。|
| devnet 不穩 | 5/9 前錄好備援 demo video。|
| Reputation 被刷分 | total_volume_settled + dispute_rate 並看。刷分需真實入金成本。|

## 8. Why NOT Token-2022 Transfer Hook
- Transfer hook 被呼叫時所有 accounts read-only → 無法寫 reputation PDA
- USDC 是既有 SPL，非我們鑄造的 Token-2022 mint → 無權加 hook
- 正解：Escrow program 在 Completed 時主動 CPI 寫 Reputation Ledger。更安全、可稽核。

## 9. Submission checklist (5/11)
- [ ] GitHub repo (public)
- [ ] 3-min pitch video (YouTube/Loom)
- [ ] Live demo URL (Vercel + devnet)
- [ ] Pitch deck (PDF, ≤10 頁)
- [ ] Team profile + credentials
- [ ] One-pager (Colosseum form)
- [ ] Monetization plan (form)
- [ ] User acquisition strategy (form)
- [ ] 無痕視窗驗證所有連結可存取

## 10. Mirrors
- `~/brain/wiki/projects/clearing-network/spec.md` (1:1 copy, dual-write)
