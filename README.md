# Protocol 402 - Autonomous Prediction Market Agent 🧠

Protocol 402 is an autonomous liquidity vault built on the **Arc Network**. It uses an AI Agent to manage capital efficiency by routing trades between **Cross-Chain Execution (Spot)** and **Synthetic Execution (Leverage)**.

![Protocol 402 Banner](https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop)

## 🌟 Key Features

### 1. Hybrid Execution Model
The AI Agent acts as a "Router" to handle trades differently based on leverage:
- **Spot Trades (1x)**: Executed via simulated **Circle CCTP Bridge** to Polygon. The agent bridges funds and purchases the real asset on Polymarket.
- **Leverage Trades (>1x)**: Executed **Synthetically** on Arc. The agent keeps funds in the vault and tracks the position for liquidation risk (PvP against LP).

### 2. Autonomous Liquidation System 🛡️
To protect the vault from bad debt, the Agent monitors all active leverage positions in real-time.
- **Trigger**: If a position's PnL drops below **-80%**.
- **Action**: The Agent automatically calls `settlePosition` on the smart contract to close the trade and secure the remaining collateral.

### 3. Advanced User Interface
- **Sell Tab**: Manage and close your open positions directly from the trade modal.
- **Smart Input**: Enter amount in USDC, and the UI calculates shares and potential profit automatically.
- **Real-time Notifications**: Get instant feedback on trade execution and realized PnL.

## 🏗 Architecture

### Frontend (`/app`)
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Lucide Icons
- **Auth**: Privy (Embedded Wallets)
- **Web3**: Ethers.js v6

### Backend Agent (`/backend`)
- **Language**: Python 3
- **Libraries**: Web3.py, Requests
- **Logic**: Event Listening, Oracle Integration, Liquidation Monitoring

### Smart Contracts (`/contracts`)
- **SignalVault.sol**: Manages user deposits, positions, and settlement logic.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- An Arc Testnet Wallet

### 1. Setup Frontend
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`

### 2. Setup Backend Agent
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure .env
# ARC_RPC_URL=...
# CONTRACT_ADDRESS=...

python3 agent.py
```

## 📜 License
MIT
