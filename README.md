# ⚡ FULCRUM

**The first Autonomous Hybrid Prediction Market built on Arc Network.**

> *"Give me a lever long enough and a fulcrum on which to place it, and I shall move the world."* — Archimedes

![Fulcrum Banner](https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop)

## 🌐 Overview

**Fulcrum** is a next-generation prediction market interface that solves the liquidity fragmentation problem. By utilizing an **AI Agent** as a liquidity router, Fulcrum offers users the best of both worlds:

1.  **Real Ownership:** Cross-chain execution for spot trades.
2.  **Capital Efficiency:** Synthetic leverage for high-frequency trading.

Built entirely on **Arc Network**, leveraging **Native USDC** for gas-abstracted, seamless transactions.

---

## 💡 The Hybrid Engine Architecture

Fulcrum's core innovation is its **"Router Agent"**, which dynamically routes trades based on user risk appetite:

### 🐢 Path A: Spot Execution (1x Leverage)
* **Target:** Conservative Traders.
* **Mechanism:** Cross-Chain via **Circle CCTP**.
* **Flow:** The Agent detects a 1x trade, simulates bridging USDC to Polygon, and purchases the real asset on Polymarket. The user owns the underlying probability share.

### 🐇 Path B: Synthetic Execution (2x-5x Leverage)
* **Target:** Aggressive Traders / Hedgers.
* **Mechanism:** PvP against **SignalVault (LP Pool)**.
* **Flow:** The Agent locks collateral on Arc Network instantly. No bridging required. The position is synthetic, allowing for high-speed entry/exit and up to **5x Leverage**.

---

## 🛡️ Autonomous Risk Agent (The Brain)

The system is guarded by an off-chain Python AI Agent that ensures solvency and fair pricing.

* **Oracle Feed:** Fetches real-time probabilities from Polymarket via the **x402 Protocol** (simulating data monetization/verification).
* **Liquidation Engine:** Monitors all active synthetic positions. If a leveraged position's PnL drops below **-80%**, the Agent automatically triggers `settlePosition` to protect the Liquidity Providers (LPs).
* **Gas Efficiency:** All agent actions are executed on Arc Network using native USDC, minimizing operational overhead.

---

## 🛠 Tech Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Network** | **Arc Testnet** | Layer 1 Blockchain (Native USDC Gas) |
| **Contract** | **Solidity** | `SignalVault.sol` (Liquidity & Position Logic) |
| **Backend** | **Python 3** | AI Agent, Event Listener, Risk Manager |
| **Frontend** | **Next.js 14** | Hybrid Trading Interface |
| **Auth** | **Privy** | Gasless Onboarding & Embedded Wallets |
| **Bridge** | **Circle CCTP** | Cross-Chain Simulation Infrastructure |

---

## 📂 Repository Structure

```text
fulcrum/
├── 📁 contracts/       # Hardhat project & Smart Contracts
│   └── SignalVault.sol # Main Liquidity Vault logic
├── 📁 frontend/        # Next.js App (The Trading Terminal)
│   ├── app/page.tsx    # Main Hybrid Interface
│   └── ...
├── 📁 agent/           # Python AI Agent (The Brain)
│   ├── agent.py        # Main Router Logic
│   └── requirements.txt
└── README.md           # Documentation