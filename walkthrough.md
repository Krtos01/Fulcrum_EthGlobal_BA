# Protocol 402 - Python AI Agent Backend Walkthrough

I have successfully set up the Python backend for the Protocol 402 AI Agent.

## 📂 Project Structure
- **`backend/`**: Directory containing all agent code.
    - **`agent.py`**: The main script that connects to Arc Testnet and listens for events.
    - **`abi.json`**: The Contract ABI definition.
    - **`requirements.txt`**: Python dependencies.
    - **`.env`**: Configuration file (created from `env.sample`).

## 🚀 How to Run the Agent

### 1. Prerequisites
Ensure you have Python 3 installed.

### 2. Setup
Navigate to the backend directory and install dependencies:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Configuration
**CRITICAL**: You must update the `.env` file with your actual Arc Testnet RPC URL and Agent Private Key.
```bash
# Open .env and edit:
ARC_RPC_URL=https://... (Your Arc Testnet RPC)
AGENT_PRIVATE_KEY=0x... (Your Agent Wallet Private Key)
```

### 4. Running the Agent
Start the agent:
```bash
python3 agent.py
```

## 🔍 Verification
- The agent will print `✅ Connected to Arc Testnet` if the RPC URL is correct.
- It will then start listening for `PositionOpened` events.
- When you open a position on the frontend, the agent will detect it and print the details to the console.

## 🛠 Next Steps
- Implement the `check_liquidation` logic to call `settlePosition` on the smart contract when conditions are met.

## 🎨 Frontend Features Added
I have enhanced the frontend with the following features:

### 1. Sell Tab
- Added a **"Sell"** tab to the trade modal.
- Users can now view their open positions for a specific market.
- A "Sell" button allows users to close specific positions directly from the modal.

### 2. Polymarket-Style Amount Input
- Replaced the generic leverage slider with a **"Amount (USDC)"** input field.
- The UI now automatically calculates:
    - **Shares**: How many shares you get for your USDC.
    - **Max Payout**: The maximum return if you win.
    - **Potential Profit**: Your net profit.

### 3. Instant Position Closing
- Fixed the "Close Position" button on the transaction success screen.
- Closing a position now **immediately removes** the card from the UI, providing instant feedback.

### 4. Success Notification
- Added a sleek notification banner that appears when a position is closed.
- Displays the **Realized PnL** (Profit/Loss) for the closed position.

## 🧠 Hybrid Execution Model
The backend agent now implements a "Router" logic to handle trades differently based on leverage:

### 1. Spot Trades (1x Leverage)
- **Action**: Cross-Chain Execution.
- **Process**:
    1. Agent detects `leverage == 1`.
    2. Initiates a simulated **Circle CCTP Bridge** transaction to Polygon.
    3. Simulates purchasing the asset on Polymarket.
    4. Logs "Asset Bridged & Purchased on Polygon".

### 2. Leverage Trades (>1x Leverage)
- **Action**: Synthetic Execution (PvP).
- **Process**:
    1. Agent detects `leverage > 1`.
    2. **No bridging** occurs. Funds stay on Arc.
    3. Agent tracks the position for **Liquidation Risk**.
    4. Acts as an Oracle to monitor price vs entry price.

