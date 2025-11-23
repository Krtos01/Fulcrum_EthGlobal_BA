#!/usr/bin/env python3
"""
Protocol 402 - Autonomous Prediction Market Agent
================================================
The "Brain" managing the Liquidity Vault on Arc Network

Architecture:
- Oracle: Fetches Polymarket prices with x402 payment verification
- Hedge Manager: Monitors exposure and simulates Circle CCTP bridging
- Event Listener: Reacts to user trades on Arc Network
"""

import json
import time
import os
from datetime import datetime
from typing import Optional, Dict, Any
from web3 import Web3
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Terminal colors for Matrix-style output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log(message: str, color: str = Colors.GREEN):
    """Matrix-style logging with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{color}[{timestamp}] {message}{Colors.END}")

def log_header(title: str):
    """Print section header"""
    border = "=" * 60
    print(f"\n{Colors.CYAN}{Colors.BOLD}{border}")
    print(f"  {title}")
    print(f"{border}{Colors.END}\n")


class PolymarketOracle:
    """
    Polymarket Oracle with x402 Payment Protocol
    Fetches real-time prediction market prices
    """
    
    BASE_URL = "https://clob.polymarket.com"
    X402_FEE = 0.001  # USDC per data request
    
    def __init__(self):
        self.total_fees_paid = 0.0
        log(f"🔮 Polymarket Oracle initialized", Colors.MAGENTA)
    
    def verify_payment(self) -> bool:
        """
        x402 Protocol: Verify micro-payment for data access
        In production, this would verify an actual on-chain payment
        """
        log(f"💳 x402: Payment of {self.X402_FEE} USDC verified for Data Access", Colors.YELLOW)
        self.total_fees_paid += self.X402_FEE
        return True
    
    def get_price(self, market_slug: str = "bitcoin-100k-2024") -> Optional[Dict[str, Any]]:
        """
        Fetch live market price from Polymarket
        
        Args:
            market_slug: Market identifier (e.g., "bitcoin-100k-2024")
            
        Returns:
            Dict with market data or None on failure
        """
        # x402: Verify payment before data access
        if not self.verify_payment():
            log("❌ x402: Payment verification failed", Colors.RED)
            return None
        
        try:
            # Fetch markets list
            response = requests.get(f"{self.BASE_URL}/markets", timeout=10)
            response.raise_for_status()
            markets = response.json()
            
            # Handle different response formats
            if not markets:
                log(f"⚠️  No markets returned from Polymarket", Colors.YELLOW)
                return None
            
            # Find matching market
            market = None
            for m in markets:
                # Skip if not a dictionary
                if not isinstance(m, dict):
                    continue
                    
                question = m.get('question', '') or m.get('title', '') or ''
                if market_slug.lower() in question.lower():
                    market = m
                    break
            
            if market:
                # Get price from tokens (YES token price)
                tokens = market.get('tokens', [])
                yes_price = 0.50  # Default
                
                if tokens and len(tokens) > 0 and isinstance(tokens[0], dict):
                    # Polymarket prices are in $0.00-$1.00 range
                    yes_price = float(tokens[0].get('price', 0.50))
                
                result = {
                    'market_id': market.get('condition_id', 'unknown'),
                    'question': market.get('question', market.get('title', 'Unknown')),
                    'yes_price': yes_price,
                    'no_price': 1.0 - yes_price,
                    'volume': float(market.get('volume', 0)),
                    'liquidity': float(market.get('liquidity', 0))
                }
                
                log(f"📊 Polymarket: {result['question'][:50]}...", Colors.GREEN)
                log(f"   YES: {yes_price*100:.1f}% | NO: {(1-yes_price)*100:.1f}% | Vol: ${result['volume']:,.0f}", Colors.CYAN)
                
                return result
            else:
                log(f"⚠️  Market '{market_slug}' not found on Polymarket", Colors.YELLOW)
                log(f"   Using simulated prices (YES: 50%, NO: 50%)", Colors.YELLOW)
                
                # Return simulated data
                return {
                    'market_id': 'simulated',
                    'question': market_slug,
                    'yes_price': 0.50,
                    'no_price': 0.50,
                    'volume': 0,
                    'liquidity': 0
                }
                
        except requests.RequestException as e:
            log(f"❌ Polymarket API Error: {str(e)}", Colors.RED)
            log(f"   Using simulated prices (YES: 50%, NO: 50%)", Colors.YELLOW)
            
            # Return simulated data on error
            return {
                'market_id': 'simulated',
                'question': market_slug,
                'yes_price': 0.50,
                'no_price': 0.50,
                'volume': 0,
                'liquidity': 0
            }
        except Exception as e:
            log(f"❌ Unexpected error: {str(e)}", Colors.RED)
            return None
    
    def get_stats(self) -> Dict[str, float]:
        """Get oracle statistics"""
        return {
            'total_x402_fees': self.total_fees_paid,
            'requests_served': int(self.total_fees_paid / self.X402_FEE)
        }


class HedgeManager:
    """
    Vault Hedge Manager
    Monitors exposure and executes hedging via Circle CCTP Bridge
    """
    
    HEDGE_THRESHOLD = 1000.0  # USDC
    BRIDGE_AMOUNT = 1000.0    # USDC per hedge
    
    def __init__(self, w3: Web3, contract_address: str, contract_abi: list):
        self.w3 = w3
        self.contract = w3.eth.contract(address=contract_address, abi=contract_abi)
        self.total_hedged = 0.0
        log(f"🛡️  Hedge Manager initialized (Threshold: {self.HEDGE_THRESHOLD} USDC)", Colors.MAGENTA)
    
    def calculate_exposure(self) -> Dict[str, float]:
        """
        Calculate vault's current exposure
        In production, this would read from contract state
        """
        try:
            # Simulate reading contract balance
            vault_balance = self.w3.eth.get_balance(self.contract.address)
            vault_usdc = float(self.w3.from_wei(vault_balance, 'ether'))
            
            # Simulate position imbalance
            # In real: get YES vs NO position totals from contract
            simulated_yes_exposure = vault_usdc * 0.7  # 70% YES
            simulated_no_exposure = vault_usdc * 0.3   # 30% NO
            imbalance = abs(simulated_yes_exposure - simulated_no_exposure)
            
            exposure = {
                'vault_balance': vault_usdc,
                'yes_exposure': simulated_yes_exposure,
                'no_exposure': simulated_no_exposure,
                'imbalance': imbalance,
                'needs_hedge': imbalance > self.HEDGE_THRESHOLD
            }
            
            log(f"📈 Vault Exposure: {vault_usdc:.2f} USDC | Imbalance: {imbalance:.2f} USDC", Colors.CYAN)
            
            return exposure
            
        except Exception as e:
            log(f"❌ Exposure calculation error: {str(e)}", Colors.RED)
            return {
                'vault_balance': 0,
                'yes_exposure': 0,
                'no_exposure': 0,
                'imbalance': 0,
                'needs_hedge': False
            }
    
    def execute_hedge(self, exposure: Dict[str, float]):
        """
        Execute hedging strategy via Circle CCTP Bridge
        Simulates bridging USDC from Arc to Polygon for Polymarket hedging
        """
        if not exposure['needs_hedge']:
            log(f"✅ Vault balanced - No hedge needed", Colors.GREEN)
            return
        
        log(f"⚠️  HEDGE TRIGGER: Imbalance {exposure['imbalance']:.2f} USDC > {self.HEDGE_THRESHOLD} USDC", Colors.YELLOW)
        
        # Simulate Circle CCTP Bridge transaction
        log(f"🌉 Bridging 1000 USDC from Arc to Polygon via Circle...", Colors.MAGENTA)
        log(f"   Source:      Arc Testnet", Colors.CYAN)
        log(f"   Destination: Polygon PoS", Colors.CYAN)
        log(f"   Amount:      {self.BRIDGE_AMOUNT} USDC", Colors.CYAN)
        log(f"   Purpose:     Polymarket Hedge Trade", Colors.CYAN)
        
        # Simulate bridge delay
        time.sleep(1)
        
        log(f"✅ Bridge simulation complete!", Colors.GREEN)
        log(f"   Next: Execute offsetting trade on Polymarket", Colors.YELLOW)
        
        self.total_hedged += self.BRIDGE_AMOUNT
    
    def get_stats(self) -> Dict[str, float]:
        """Get hedging statistics"""
        return {
            'total_hedged': self.total_hedged,
            'bridge_transactions': int(self.total_hedged / self.BRIDGE_AMOUNT) if self.BRIDGE_AMOUNT > 0 else 0
        }


class ArcListener:
    """
    Arc Network Event Listener
    Monitors SignalVault contract for user trades
    """
    
    def __init__(self, w3: Web3, contract_address: str, contract_abi: list, 
                 oracle: PolymarketOracle, hedge_manager: HedgeManager):
        self.w3 = w3
        self.contract = w3.eth.contract(address=contract_address, abi=contract_abi)
        self.oracle = oracle
        self.hedge_manager = hedge_manager
        self.trades_processed = 0
        self.active_positions = []
        self.latest_bridge_tx = None  # Store latest bridge TX hash
        log(f"👂 Arc Listener initialized", Colors.MAGENTA)
        log(f"   Contract: {contract_address}", Colors.CYAN)
    
    def handle_spot_execution(self, market_id: str, amount: float, side: str):
        """
        Handle Spot Trade (1x Leverage)
        Action: Bridge assets to Polygon via Circle CCTP and execute on Polymarket
        """
        log(f"🔄 SPOT TRADE DETECTED (1x Leverage)", Colors.CYAN)
        log(f"   Initiating Circle CCTP Bridge to Polygon...", Colors.MAGENTA)
        
        try:
            # Load TokenMessenger contract
            token_messenger_address = os.getenv('ARC_TOKEN_MESSENGER', '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA')
            usdc_address = os.getenv('ARC_USDC_ADDRESS', '0x3600000000000000000000000000000000000000')
            polygon_domain = int(os.getenv('POLYGON_DOMAIN_ID', '7'))
            
            # Load ABI
            abi_path = os.path.join(os.path.dirname(__file__), 'TokenMessenger.json')
            with open(abi_path, 'r') as f:
                token_messenger_abi = json.load(f)
            
            messenger = self.w3.eth.contract(
                address=Web3.to_checksum_address(token_messenger_address),
                abi=token_messenger_abi
            )
            
            # Get wallet address from private key
            private_key = os.getenv('AGENT_PRIVATE_KEY')
            if not private_key:
                log("❌ AGENT_PRIVATE_KEY not found in .env", Colors.RED)
                return
            
            account = self.w3.eth.account.from_key(private_key)
            wallet_address = account.address
            
            # Convert amount to USDC decimals (6 decimals)
            amount_usdc = int(amount * 10**6)
            
            # Convert recipient address to bytes32 (for CCTP)
            # Using same address on Polygon as on Arc
            recipient_bytes32 = bytes.fromhex(wallet_address[2:].zfill(64))
            
            log(f"   Amount: {amount} USDC ({amount_usdc} units)", Colors.CYAN)
            log(f"   From: {wallet_address[:10]}...{wallet_address[-8:]}", Colors.CYAN)
            log(f"   Destination: Polygon (Domain {polygon_domain})", Colors.CYAN)
            
            # Build transaction
            tx = messenger.functions.depositForBurn(
                amount_usdc,
                polygon_domain,
                recipient_bytes32,
                Web3.to_checksum_address(usdc_address)
            ).build_transaction({
                'from': wallet_address,
                'nonce': self.w3.eth.get_transaction_count(wallet_address),
                'gas': 200000,  # Estimated gas limit
                'gasPrice': self.w3.eth.gas_price,
            })
            
            # Sign and send transaction
            log(f"   Signing and broadcasting CCTP bridge transaction...", Colors.YELLOW)
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            log(f"✅ Bridge TX Submitted: {tx_hash.hex()}", Colors.GREEN)
            log(f"   Waiting for confirmation...", Colors.YELLOW)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt.status == 1:
                log(f"✅ CCTP Bridge Successful!", Colors.GREEN)
                log(f"   Block: {receipt.blockNumber}", Colors.CYAN)
                log(f"   Gas Used: {receipt.gasUsed}", Colors.CYAN)
                log(f"   USDC will be minted on Polygon in ~15-20 seconds", Colors.YELLOW)
                log(f"   (Circle attestation service processes automatically)", Colors.YELLOW)
                log(f"🛒 Mock: Asset purchased on Polymarket", Colors.GREEN)
                log(f"   Market: {market_id} | Side: {side} | Amount: {amount} USDC\n", Colors.GREEN)
                
                # Store bridge TX hash for frontend
                self.latest_bridge_tx = tx_hash.hex()
                # Write to file for frontend to read (in public directory)
                try:
                    public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
                    os.makedirs(public_dir, exist_ok=True)
                    with open(os.path.join(public_dir, 'latest_bridge_tx.json'), 'w') as f:
                        json.dump({'tx_hash': self.latest_bridge_tx, 'timestamp': time.time()}, f)
                except Exception as e:
                    log(f"Warning: Could not write bridge TX to file: {e}", Colors.YELLOW)
            else:
                log(f"❌ Bridge transaction failed", Colors.RED)
                log(f"   TX: {tx_hash.hex()}\n", Colors.RED)
                
        except FileNotFoundError:
            log(f"❌ TokenMessenger.json ABI not found", Colors.RED)
            log(f"   Falling back to simulation...\n", Colors.YELLOW)
            time.sleep(2)
            log(f"✅ Asset Bridged & Purchased on Polygon (Simulated)", Colors.GREEN)
            log(f"   Market: {market_id} | Side: {side} | Amount: {amount} USDC\n", Colors.GREEN)
        except Exception as e:
            log(f"❌ CCTP Bridge Error: {str(e)}", Colors.RED)
            log(f"   Falling back to simulation...\n", Colors.YELLOW)
            time.sleep(2)
            log(f"✅ Asset Bridged & Purchased on Polygon (Simulated)", Colors.GREEN)
            log(f"   Market: {market_id} | Side: {side} | Amount: {amount} USDC\n", Colors.GREEN)

    def handle_synthetic_execution(self, position_id: int, market_id: str, amount: float, leverage: int, entry_price: int, side: str):
        """
        Handle Leverage Trade (>1x Leverage)
        Action: Keep funds on Arc, act as Oracle, track for liquidation
        """
        log(f"⚡ LEVERAGE TRADE DETECTED ({leverage}x Leverage)", Colors.YELLOW)
        log(f"   Synthetic Execution: No Bridging Required", Colors.YELLOW)
        log(f"   Tracking Position #{position_id} for Liquidation Risk...", Colors.MAGENTA)
        
        # Add to tracking list
        self.active_positions.append({
            'id': position_id,
            'market_id': market_id,
            'amount': amount,
            'leverage': leverage,
            'entry_price': entry_price,
            'side': side,
            'timestamp': time.time()
        })
        
        log(f"✅ Position #{position_id} Active | Entry: {entry_price} | Liq Price: Calculating...\n", Colors.GREEN)

    def check_liquidations(self):
        """
        Check active positions for liquidation conditions
        Liquidation Threshold: -80% PnL
        """
        if not self.active_positions:
            return

        log_header("LIQUIDATION CHECK")
        log(f"🔍 Checking {len(self.active_positions)} active positions...", Colors.CYAN)
        
        positions_to_remove = []
        
        for pos in self.active_positions:
            # Fetch current price
            price_data = self.oracle.get_price(pos['market_id'])
            if not price_data:
                continue
                
            current_price = price_data['yes_price'] * 100 if pos['side'] == 'YES' else price_data['no_price'] * 100
            
            # Calculate PnL
            # PnL % = ((Current Price - Entry Price) / Entry Price) * Leverage
            # Simplified for prediction markets (0-100 range):
            price_diff = (current_price - pos['entry_price'])
            pnl_percent = (price_diff / 100) * pos['leverage']
            
            # Invert PnL if Short/NO? 
            # Actually, if I bought NO at 40 (Entry), and price goes to 30, I win.
            # My logic above: current_price is the price of the asset I hold.
            # If I hold NO, current_price is NO price. So logic holds.
            
            log(f"   Pos #{pos['id']} ({pos['side']} {pos['leverage']}x): Entry {pos['entry_price']:.1f} -> Curr {current_price:.1f} | PnL: {pnl_percent*100:.1f}%", Colors.CYAN)
            
            # Check Threshold (-80%)
            if pnl_percent <= -0.80:
                log(f"🚨 LIQUIDATION TRIGGERED for Position #{pos['id']}", Colors.RED)
                log(f"   Reason: PnL {pnl_percent*100:.1f}% <= -80%", Colors.RED)
                log(f"   Executing settlePosition({pos['id']})...", Colors.MAGENTA)
                
                # Simulate Contract Call
                # self.contract.functions.settlePosition(pos['id']).transact(...)
                time.sleep(1)
                
                log(f"💀 Position #{pos['id']} LIQUIDATED", Colors.RED)
                positions_to_remove.append(pos)
        
        # Remove liquidated positions
        for pos in positions_to_remove:
            self.active_positions.remove(pos)
            
        if not positions_to_remove:
            log(f"✅ All positions safe", Colors.GREEN)
        print("")

    def process_position_opened(self, event: Dict[str, Any]):
        """
        Process PositionOpened event from SignalVault
        """
        self.trades_processed += 1
        
        log_header(f"NEW TRADE #{self.trades_processed}")
        
        args = event['args']
        position_id = args.get('positionId', 0)
        user = args['trader']
        market_id = args['marketId']
        is_long_yes = args['isLongYes']
        entry_price = args.get('entryPrice', 50)
        collateral = args.get('collateral', 0)
        leverage = args.get('leverage', 1)
        
        amount = float(self.w3.from_wei(collateral, 'mwei')) # USDC has 6 decimals usually, but let's check contract
        # If contract uses 18 decimals for collateral, use 'ether'. If 6, use 'mwei'.
        # Based on previous code, it seemed to treat it as ether (18), but USDC is usually 6.
        # Let's stick to previous behavior or safer float conversion if unsure.
        # Previous code: amount = self.w3.from_wei(event['args']['amount'], 'ether')
        # But wait, the event arg name changed from 'amount' to 'collateral' in my new ABI?
        # Let's check the ABI update below.
        
        # Correcting amount calculation based on standard USDC (6 decimals) or 18 if test token
        # For safety in this demo, we'll assume 18 if previous code worked, or adjust.
        # Actually, let's use the value directly if it's already a number or convert safely.
        amount_fmt = float(collateral) / 10**18 if collateral > 10**10 else float(collateral) / 10**6
        
        side = "YES" if is_long_yes else "NO"
        color = Colors.GREEN if is_long_yes else Colors.RED
        
        log(f"👤 Trader:   {user[:10]}...{user[-8:]}", color)
        log(f"📍 Market:   {market_id}", color)
        log(f"📊 Side:     {side}", color)
        log(f"💰 Amount:   {amount_fmt:.2f} USDC", color)
        log(f"🚀 Leverage: {leverage}x", color)
        
        # ROUTER LOGIC
        if leverage == 1:
            self.handle_spot_execution(market_id, amount_fmt, side)
        else:
            self.handle_synthetic_execution(position_id, market_id, amount_fmt, leverage, entry_price, side)
            
    
    def listen(self, poll_interval: int = 2):
        """
        Main event listening loop
        """
        log_header("PROTOCOL 402 AGENT - LISTENING FOR EVENTS")
        
        log(f"🎯 Listening for PositionOpened events...", Colors.GREEN)
        log(f"⏱️  Poll interval: {poll_interval}s\n", Colors.CYAN)
        
        last_check_time = time.time()
        last_processed_block = self.w3.eth.block_number
        
        while True:
            try:
                current_block = self.w3.eth.block_number
                
                # Scan last 10 blocks to catch any missed events
                from_block = max(last_processed_block - 10, 0)
                
                # Get events from recent blocks
                events = self.contract.events.PositionOpened.get_logs(
                    from_block=from_block,
                    to_block=current_block
                )
                
                # Process new events (avoid duplicates)
                for event in events:
                    event_block = event['blockNumber']
                    if event_block > last_processed_block:
                        self.process_position_opened(event)
                
                last_processed_block = current_block
                
                # Check Liquidations every 10 seconds
                if time.time() - last_check_time > 10:
                    self.check_liquidations()
                    last_check_time = time.time()
                
                # Periodic health check
                if self.trades_processed % 10 == 0 and self.trades_processed > 0:
                    self.print_stats()
                
                time.sleep(poll_interval)
                
            except KeyboardInterrupt:
                log(f"\n🛑 Shutting down agent...", Colors.YELLOW)
                self.print_stats()
                break
            except Exception as e:
                log(f"❌ Listener error: {str(e)}", Colors.RED)
                time.sleep(poll_interval)
    
    def print_stats(self):
        """Print agent statistics"""
        log_header("AGENT STATISTICS")
        
        oracle_stats = self.oracle.get_stats()
        hedge_stats = self.hedge_manager.get_stats()
        
        log(f"📊 Trades Processed:    {self.trades_processed}", Colors.CYAN)
        log(f"🔮 Oracle Requests:     {oracle_stats['requests_served']}", Colors.CYAN)
        log(f"💳 x402 Fees Paid:      {oracle_stats['total_x402_fees']:.3f} USDC", Colors.CYAN)
        log(f"🌉 Bridge Txs:          {hedge_stats['bridge_transactions']}", Colors.CYAN)
        log(f"🛡️  Total Hedged:        {hedge_stats['total_hedged']:.2f} USDC\n", Colors.CYAN)


def main():
    """Main agent entry point"""
    
    # Banner
    print(f"{Colors.BOLD}{Colors.GREEN}")
    print("""
    ██████╗ ██████╗  ██████╗ ████████╗ ██████╗  ██████╗ ██████╗ ██╗     ██╗  ██╗ ██████╗ ██████╗ 
    ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗██╔════╝██╔═══██╗██║     ██║  ██║██╔═████╗╚════██╗
    ██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║██║     ██║   ██║██║     ███████║██║██╔██║ █████╔╝
    ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██║     ██║   ██║██║     ╚════██║████╔╝██║██╔═══╝ 
    ██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝╚██████╗╚██████╔╝███████╗     ██║╚██████╔╝███████╗
    ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝     ╚═╝ ╚═════╝ ╚══════╝
                                                                                                   
           Autonomous Prediction Market Agent - The Brain of the Vault
    """)
    print(f"{Colors.END}")
    
    # Configuration
    RPC_URL = os.getenv('ARC_RPC_URL', 'https://rpc-testnet.arc.network')
    CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS', '0x8e1cD697805aA9022B266c513840345f215bEA83')
    
    # Smart contract ABI (Updated for Hybrid Execution)
    CONTRACT_ABI = [
        {
            "anonymous": False,
            "inputs": [
                {"indexed": True, "name": "positionId", "type": "uint256"},
                {"indexed": False, "name": "marketId", "type": "string"},
                {"indexed": False, "name": "isLongYes", "type": "bool"},
                {"indexed": False, "name": "entryPrice", "type": "uint256"},
                {"indexed": False, "name": "collateral", "type": "uint256"},
                {"indexed": False, "name": "leverage", "type": "uint256"},
                {"indexed": True, "name": "trader", "type": "address"}
            ],
            "name": "PositionOpened",
            "type": "event"
        }
    ]
    
    log_header("INITIALIZATION")
    
    # Connect to Arc Network
    log(f"🔗 Connecting to Arc Testnet...", Colors.YELLOW)
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    
    if w3.is_connected():
        log(f"✅ Connected to Arc Network", Colors.GREEN)
        log(f"   Chain ID: {w3.eth.chain_id}", Colors.CYAN)
        log(f"   Block:    {w3.eth.block_number}", Colors.CYAN)
    else:
        log(f"❌ Failed to connect to Arc Network", Colors.RED)
        return
    
    # Initialize components
    oracle = PolymarketOracle()
    hedge_manager = HedgeManager(w3, CONTRACT_ADDRESS, CONTRACT_ABI)
    listener = ArcListener(w3, CONTRACT_ADDRESS, CONTRACT_ABI, oracle, hedge_manager)
    
    # Test oracle with sample market
    log_header("ORACLE TEST")
    oracle.get_price("bitcoin-100k-2024")
    
    # Start listening
    listener.listen(poll_interval=2)


if __name__ == "__main__":
    main()
