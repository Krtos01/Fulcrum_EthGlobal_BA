#!/usr/bin/env python3
"""
Protocol 402 - Webhook-Based Leverage System
Fast & Simple approach using Flask API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import time
import requests
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow frontend to call API

# In-memory position storage
active_positions = []
position_lock = threading.Lock()

# Colors for terminal
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    RESET = '\033[0m'

def log(message, color=Colors.RESET):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{color}[{timestamp}] {message}{Colors.RESET}")

# Polymarket Oracle (simplified)
def get_market_price(market_id):
    """Simulate getting market price - returns 50% for now"""
    return 50  # Simulated price

# API Endpoints
@app.route('/api/position/opened', methods=['POST'])
def position_opened():
    """Receive position data from frontend"""
    try:
        data = request.json
        
        position_id = data.get('positionId')
        market_id = data.get('marketId')
        is_long_yes = data.get('isLongYes')
        entry_price = data.get('entryPrice')
        collateral = data.get('collateral')
        leverage = data.get('leverage')
        trader = data.get('trader')
        
        # Handle based on leverage
        if leverage == 1:
            log(f"🔄 SPOT TRADE (1x Leverage)", Colors.CYAN)
            log(f"   Market: {market_id} | Side: {'YES' if is_long_yes else 'NO'}", Colors.CYAN)
            log(f"   Initiating CCTP Bridge...\n", Colors.MAGENTA)
            # CCTP logic would go here (already implemented in frontend)
            
        else:
            log(f"⚡ LEVERAGE TRADE ({leverage}x)", Colors.YELLOW)
            log(f"   Position #{position_id} | Market: {market_id}", Colors.YELLOW)
            log(f"   Entry: {entry_price}% | Collateral: {collateral}", Colors.YELLOW)
            
            # Add to tracking
            with position_lock:
                active_positions.append({
                    'id': position_id,
                    'market_id': market_id,
                    'is_long_yes': is_long_yes,
                    'entry_price': entry_price,
                    'collateral': float(collateral),
                    'leverage': leverage,
                    'trader': trader,
                    'timestamp': time.time()
                })
            
            log(f"✅ Position #{position_id} Tracked for Liquidation\n", Colors.GREEN)
        
        return jsonify({'status': 'success', 'message': 'Position recorded'}), 200
        
    except Exception as e:
        log(f"❌ Error processing position: {e}", Colors.RED)
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/position/closed', methods=['POST'])
def position_closed():
    """Remove position from tracking when closed"""
    try:
        data = request.json
        position_id = data.get('positionId')
        
        with position_lock:
            active_positions[:] = [p for p in active_positions if p['id'] != position_id]
        
        log(f"🔴 Position #{position_id} Closed", Colors.CYAN)
        return jsonify({'status': 'success'}), 200
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/positions', methods=['GET'])
def get_positions():
    """Return list of active positions"""
    with position_lock:
        # Return a copy to avoid race conditions
        positions_copy = [p.copy() for p in active_positions]
    return jsonify({'status': 'success', 'positions': positions_copy}), 200

# Liquidation Loop (background thread)
def liquidation_monitor():
    """Background thread to check for liquidations"""
    log("🛡️  Liquidation Monitor Started", Colors.MAGENTA)
    
    while True:
        try:
            time.sleep(10)  # Check every 10 seconds
            
            if not active_positions:
                continue
            
            with position_lock:
                positions_copy = active_positions.copy()
            
            for position in positions_copy:
                # Get current market price
                current_price = get_market_price(position['market_id'])
                
                # Calculate PnL
                entry_price = position['entry_price']
                leverage = position['leverage']
                is_long_yes = position['is_long_yes']
                
                # PnL calculation
                if is_long_yes:
                    price_change = current_price - entry_price
                else:
                    price_change = entry_price - current_price
                
                pnl_pct = (price_change / 100) * leverage * 100
                
                # Check for liquidation (PnL <= -80%)
                if pnl_pct <= -80:
                    log(f"💀 LIQUIDATION TRIGGERED!", Colors.RED)
                    log(f"   Position #{position['id']} | PnL: {pnl_pct:.2f}%", Colors.RED)
                    log(f"   Entry: {entry_price}% | Current: {current_price}%", Colors.YELLOW)
                    
                    # Remove from tracking
                    with position_lock:
                        active_positions[:] = [p for p in active_positions if p['id'] != position['id']]
                    
                    log(f"   Position liquidated and removed from tracking\n", Colors.RED)
                    
        except Exception as e:
            log(f"❌ Liquidation monitor error: {e}", Colors.RED)

def print_banner():
    banner = """
    ██████╗ ██████╗  ██████╗ ████████╗ ██████╗  ██████╗ ██████╗ ██╗     ██╗  ██╗ ██████╗ ██████╗ 
    ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗██╔════╝██╔═══██╗██║     ██║  ██║██╔═████╗╚════██╗
    ██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║██║     ██║   ██║██║     ███████║██║██╔██║ █████╔╝
    ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██║     ██║   ██║██║     ╚════██║████╔╝██║██╔═══╝ 
    ██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝╚██████╗╚██████╔╝███████╗     ██║╚██████╔╝███████╗
    ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝     ╚═╝ ╚═════╝ ╚══════╝
                                                                                                   
           Webhook-Based Leverage System - Fast & Simple
    """
    print(f"{Colors.CYAN}{banner}{Colors.RESET}\n")

if __name__ == '__main__':
    print_banner()
    
    # Start liquidation monitor in background
    monitor_thread = threading.Thread(target=liquidation_monitor, daemon=True)
    monitor_thread.start()
    
    # Start Flask API
    log("🚀 Starting Flask API Server...", Colors.GREEN)
    log("📡 Listening on http://localhost:5001", Colors.CYAN)
    log("⏱️  Liquidation checks every 10s\n", Colors.YELLOW)
    
    app.run(host='0.0.0.0', port=5001, debug=False)
