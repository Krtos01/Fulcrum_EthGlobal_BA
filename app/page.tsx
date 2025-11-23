"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowDown, TrendingUp, Users, Search, X,
  TrendingUp as TrendingUpIcon, TrendingDown,
  BarChart3, Wallet, Loader2, ExternalLink,
  CheckCircle2, AlertCircle, Zap, Layers
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ethers } from "ethers"
import { usePrivy, useWallets } from "@privy-io/react-auth"

// --- SMART CONTRACT CONFIG ---
const CONTRACT_ADDRESS = "0x2a3895f00315013a7cBc8fF50D4ac8823B58d88f"
const CONTRACT_ABI = [
  "function openPosition(string memory _marketId, bool _isLongYes, uint256 _entryPrice, uint256 _leverage) external payable returns (uint256)",
  "function getPosition(uint256 positionId) external view returns (tuple(string marketId, address trader, bool isLongYes, uint256 entryPrice, uint256 collateral, uint256 leverage, uint256 openedAt, bool isOpen))",
  "function positions(uint256) external view returns (string marketId, address trader, bool isLongYes, uint256 entryPrice, uint256 collateral, uint256 leverage, uint256 openedAt, bool isOpen)",
  "function nextPositionId() external view returns (uint256)",
  "function closePosition(uint256 positionId) external",
  "function settlePosition(uint256 positionId) external"
]

// --- MOCK DATA ---
type Market = { id: number; title: string; image: string; volume: string; chance: number; category: string }
const MARKETS = [
  { id: 1, title: "Will SpaceX Starship reach orbit in 2025?", image: "https://images.unsplash.com/photo-1517976487492-5750f3195933?q=80&w=1000&auto=format&fit=crop", volume: "$4.2M", chance: 78, category: "Science" },
  { id: 2, title: "Fed Interest Rate Decision: Cut in December?", image: "https://images.unsplash.com/photo-1611974765270-ca1258634369?q=80&w=1000&auto=format&fit=crop", volume: "$12.5M", chance: 42, category: "Economics" },
  { id: 3, title: "Bitcoin to break $100k before Q3?", image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?q=80&w=1000&auto=format&fit=crop", volume: "$89.1M", chance: 65, category: "Crypto" },
  { id: 4, title: "Apple to announce foldable iPhone this year?", image: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?q=80&w=1000&auto=format&fit=crop", volume: "$1.8M", chance: 12, category: "Tech" },
  { id: 5, title: "Who will win the 2026 World Cup?", image: "https://images.unsplash.com/photo-1522770179533-24471fcdba45?q=80&w=1000&auto=format&fit=crop", volume: "$5.6M", chance: 18, category: "Sports" },
  { id: 6, title: "GPT-5 release date before June 2025?", image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1000&auto=format&fit=crop", volume: "$3.4M", chance: 88, category: "AI" },
]

// Position Type
type Position = {
  id: number
  marketId: string
  trader: string
  isLongYes: boolean
  entryPrice: number
  collateral: bigint
  leverage: number
  openedAt: number
  isOpen: boolean
  currentPrice?: number // For PnL calculation
  pnl?: number // Unrealized PnL in USDC
}

// Market Statistics Type
type MarketStats = {
  id: number
  yesVolume: number
  noVolume: number
  yesPrice: number
  noPrice: number
  totalVolume: number
}

// Price calculation using AMM formula
function calculateAMMPrices(yesVolume: number, noVolume: number, initialLiquidity = 1000): { yesPrice: number; noPrice: number } {
  // Add initial liquidity as baseline to prevent extreme swings
  const yesShares = (initialLiquidity / 2) + yesVolume
  const noShares = (initialLiquidity / 2) + noVolume

  const total = yesShares + noShares

  // Price = opposite shares / total shares
  const yesPrice = (noShares / total) * 100
  const noPrice = (yesShares / total) * 100

  return { yesPrice, noPrice }
}

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [showIntro, setShowIntro] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<number | null>(null)
  const [leverage, setLeverage] = useState(1)
  const [balance, setBalance] = useState<string | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [refreshPositions, setRefreshPositions] = useState(0)
  const [closingPositionId, setClosingPositionId] = useState<number | null>(null)
  const [marketStats, setMarketStats] = useState<Record<number, MarketStats>>({})
  const marketsRef = useRef<HTMLDivElement>(null)

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  // Show notification helper
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // --- PRIVY HOOKS ---
  const { login, authenticated, user } = usePrivy()
  const { wallets } = useWallets()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)

    const hasVisited = localStorage.getItem("polymarket-intro-seen")
    if (hasVisited) {
      setShowIntro(true)
    } else {
      localStorage.setItem("polymarket-intro-seen", "true")
    }

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Fetch balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (wallets.length > 0) {
        try {
          const wallet = wallets[0]
          const ethereumProvider = await wallet.getEthereumProvider()
          const provider = new ethers.BrowserProvider(ethereumProvider)
          const address = wallet.address
          const balanceWei = await provider.getBalance(address)
          const balanceUsdc = ethers.formatEther(balanceWei)
          setBalance(balanceUsdc)
        } catch (error) {
          console.error("Failed to fetch balance:", error)
        }
      } else {
        setBalance(null)
      }
    }
    fetchBalance()
  }, [wallets])

  // Fetch user positions
  const fetchPositions = async () => {
    if (wallets.length > 0) {
      try {
        const wallet = wallets[0]
        const ethereumProvider = await wallet.getEthereumProvider()
        const provider = new ethers.BrowserProvider(ethereumProvider)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

        const nextId = await contract.nextPositionId()
        const userPositions: Position[] = []

        // Fetch all positions and filter by user
        for (let i = 1; i < Number(nextId); i++) {
          try {
            const pos = await contract.getPosition(i)
            if (pos.trader.toLowerCase() === wallet.address.toLowerCase() && pos.isOpen) {
              // Find matching market for current price
              const market = MARKETS.find(m => m.title === pos.marketId)
              const currentPrice = market ? (pos.isLongYes ? market.chance : 100 - market.chance) : pos.entryPrice

              // Calculate PnL
              let pnl = 0
              if (pos.leverage === BigInt(1)) {
                // Spot: simple difference
                pnl = (Number(currentPrice) - Number(pos.entryPrice)) / 100
              } else {
                // Perpetual: (currentPrice - entryPrice) * collateral * leverage / 100
                const collateralUSDC = Number(ethers.formatUnits(pos.collateral, 6))
                pnl = ((Number(currentPrice) - Number(pos.entryPrice)) / 100) * collateralUSDC * Number(pos.leverage)
              }

              userPositions.push({
                id: i,
                marketId: pos.marketId,
                trader: pos.trader,
                isLongYes: pos.isLongYes,
                entryPrice: Number(pos.entryPrice),
                collateral: pos.collateral,
                leverage: Number(pos.leverage),
                openedAt: Number(pos.openedAt),
                isOpen: pos.isOpen,
                currentPrice: Number(currentPrice),
                pnl
              })
            }
          } catch (err) {
            // Position might not exist, continue
            continue
          }
        }

        setPositions(userPositions)
      } catch (error) {
        console.error("Failed to fetch positions:", error)
      }
    } else {
      setPositions([])
    }
  }


  useEffect(() => {
    fetchPositions()
  }, [wallets, refreshPositions])

  // Handle close position
  const handleClosePosition = async (positionId: number) => {
    if (wallets.length === 0) return

    const position = positions.find(p => p.id === positionId)
    if (!position) return

    setClosingPositionId(positionId)
    try {
      const wallet = wallets[0]
      await wallet.switchChain(5042002)

      const ethereumProvider = await wallet.getEthereumProvider()
      const provider = new ethers.BrowserProvider(ethereumProvider)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      const tx = await contract.closePosition(positionId)
      console.log("Closing position, TX Hash:", tx.hash)

      await tx.wait()

      // Calculate Realized PnL
      // We try to use the dynamic market stats if available, otherwise fallback to static market data
      const market = MARKETS.find(m => m.title === position.marketId)
      let currentPrice = position.entryPrice // Default to no change if market not found

      if (market) {
        const stats = marketStats[market.id]
        if (stats) {
          // Use dynamic AMM price
          currentPrice = position.isLongYes ? stats.yesPrice : stats.noPrice
        } else {
          // Use static chance
          currentPrice = position.isLongYes ? market.chance : 100 - market.chance
        }
      }

      let pnl = 0
      if (position.leverage === 1) {
        // Spot
        // Note: This is a simplified PnL for display. Actual payout depends on contract logic.
        // For spot, it's roughly: (currentPrice - entryPrice) * shares
        // Shares = collateral / entryPrice (roughly)
        // But let's stick to the percentage diff logic used elsewhere
        const collateralUSDC = Number(ethers.formatUnits(position.collateral, 6))
        const priceDiffPercent = (currentPrice - position.entryPrice) / 100
        pnl = collateralUSDC * priceDiffPercent // This is an approximation
      } else {
        // Perpetual
        const collateralUSDC = Number(ethers.formatUnits(position.collateral, 6))
        pnl = ((currentPrice - position.entryPrice) / 100) * collateralUSDC * position.leverage
      }

      const pnlFormatted = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`
      showNotification(`Position closed! Realized PnL: ${pnlFormatted}`, pnl >= 0 ? 'success' : 'error')

      // Remove from local state immediately for UI responsiveness
      setPositions(prev => prev.filter(p => p.id !== positionId))

      // Also fetch fresh data to be sure
      fetchPositions()

    } catch (error: any) {
      console.error("Error closing position:", error)
      showNotification("Failed to close position", 'error')
    } finally {
      setClosingPositionId(null)
    }
  }

  // Calculate market statistics from positions
  useEffect(() => {
    const stats: Record<number, MarketStats> = {}

    MARKETS.forEach(market => {
      // Find all positions for this market
      const marketPositions = positions.filter(p => p.marketId === market.title && p.isOpen)

      let yesVolume = 0
      let noVolume = 0

      // Sum up volumes for YES vs NO
      marketPositions.forEach(pos => {
        const volumeUSDC = Number(ethers.formatUnits(pos.collateral, 6))
        if (pos.isLongYes) {
          yesVolume += volumeUSDC
        } else {
          noVolume += volumeUSDC
        }
      })

      // Calculate prices using AMM formula
      const { yesPrice, noPrice } = calculateAMMPrices(yesVolume, noVolume)

      stats[market.id] = {
        id: market.id,
        yesVolume,
        noVolume,
        yesPrice,
        noPrice,
        totalVolume: yesVolume + noVolume
      }
    })

    setMarketStats(stats)
  }, [positions])


  const scrollToMarkets = () => {
    marketsRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleMarketClick = (marketId: number) => {
    setSelectedMarket(marketId)
  }

  const closeMarket = () => {
    setSelectedMarket(null)
  }

  useEffect(() => {
    if (selectedMarket) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [selectedMarket])

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
      {/* Notification Banner */}
      {notification && (
        <div className={cn(
          "fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl font-bold text-sm animate-fade-in-down flex items-center gap-2 backdrop-blur-md",
          notification.type === 'success' ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
        )}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* Navigation */}
      <nav
        className={cn(
          "fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 transition-all duration-500",
          isScrolled || !showIntro ? "bg-background/80 backdrop-blur-md border-b border-border" : "bg-transparent",
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-background" />
          </div>
          <span className="font-bold text-xl tracking-tight">Protocol 402</span>
        </div>

        <div
          className={cn(
            "hidden md:flex items-center gap-1 border border-border rounded-full px-3 py-1.5 bg-secondary/50 w-96 transition-opacity duration-300",
            isScrolled || !showIntro ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search markets..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-4">
          <div
            className={cn(
              "hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground transition-opacity duration-300",
              isScrolled || !showIntro ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            <a href="#" className="hover:text-foreground transition-colors">
              Markets
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Leaderboard
            </a>
          </div>
          <button
            onClick={login}
            className="px-4 py-2 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            {authenticated && user?.wallet ? (
              <span className="flex items-center gap-2">
                <span>{`${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)} `}</span>
                {balance && <span className="text-xs opacity-80">| {parseFloat(balance).toFixed(2)} USDC</span>}
              </span>
            ) : "Connect Wallet"}
          </button>
        </div>
      </nav>

      <main className="relative flex flex-col">
        {/* INTRO SECTION */}
        {showIntro && (
          <section className="min-h-screen flex flex-col items-center justify-center p-6 text-center z-10 relative">
            <div className="max-w-4xl space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9]">
                  Bet on your <br />
                  <span className="text-muted-foreground">convictions.</span>
                </h1>
                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light">
                  Autonomous leverage agent on Arc Network. Trade on news, politics, and culture with AI precision.
                </p>
              </div>

              <div
                onClick={scrollToMarkets}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-foreground text-background rounded-full text-lg font-medium cursor-pointer hover:scale-105 transition-transform duration-300"
              >
                Start Trading
                <ArrowDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                <div className="absolute -inset-3 bg-foreground/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
              </div>

              <div className="pt-12 grid grid-cols-3 gap-8 md:gap-16 text-center">
                <Stat label="Volume Traded" value="$2.4M+" />
                <Stat label="Arc Gas Saved" value="12K USDC" />
                <Stat label="Markets" value="500+" />
              </div>
            </div>
          </section>
        )}

        {/* POSITIONS PANEL */}
        {authenticated && positions.length > 0 && (
          <section className={cn(
            "w-full px-4 md:px-8 py-6 max-w-[1600px] mx-auto",
            showIntro ? "pt-32" : "pt-24"
          )}>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Layers className="w-6 h-6" />
                My Positions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {positions.map((position) => (
                  <div
                    key={position.id}
                    className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-foreground/20 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm line-clamp-2">{position.marketId}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            position.isLongYes ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"
                          )}>
                            {position.isLongYes ? "YES" : "NO"}
                          </span>
                          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
                            {position.leverage}x
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entry Price:</span>
                        <span className="font-medium">{position.entryPrice}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Price:</span>
                        <span className="font-medium">{position.currentPrice}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Collateral:</span>
                        <span className="font-medium">{Number(ethers.formatUnits(position.collateral, 6)).toFixed(2)} USDC</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="text-muted-foreground font-semibold">Unrealized PnL:</span>
                        <span className={cn(
                          "font-bold",
                          position.pnl && position.pnl > 0 ? "text-green-600" : position.pnl && position.pnl < 0 ? "text-red-500" : "text-muted-foreground"
                        )}>
                          {position.pnl && position.pnl > 0 ? "+" : ""}{position.pnl?.toFixed(2) || "0.00"} USDC
                        </span>
                      </div>
                    </div>

                    <button
                      className="w-full py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      onClick={() => handleClosePosition(position.id)}
                      disabled={closingPositionId === position.id}
                    >
                      {closingPositionId === position.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Closing...
                        </>
                      ) : (
                        "Close Position"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* MARKETS GRID */}
        <section
          ref={marketsRef}
          className="flex-1 pt-24 px-4 md:px-8 pb-12 max-w-[1600px] mx-auto w-full bg-background min-h-screen"
        >
          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-6 scrollbar-hide">
            {["Top", "New", "Politics", "Crypto", "Sports", "Business", "Science", "AI"].map((cat, i) => (
              <button
                key={cat}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                  i === 0
                    ? "bg-foreground text-background"
                    : "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 transition-all duration-500",
            selectedMarket ? "blur-md opacity-60 scale-95" : ""
          )}>
            {MARKETS.map((market, index) => (
              <MarketCard
                key={market.id}
                market={market}
                marketStats={marketStats[market.id]}
                index={index}
                onClick={() => handleMarketClick(market.id)}
                isSelected={selectedMarket === market.id}
              />
            ))}
          </div>
        </section>

        {/* Expanded Market View */}
        {selectedMarket && (
          <ExpandedMarketView
            market={MARKETS.find(m => m.id === selectedMarket)!}
            marketStats={marketStats[selectedMarket]}
            onClose={closeMarket}
            leverage={leverage}
            setLeverage={setLeverage}
            wallets={wallets}
            authenticated={authenticated}
            login={login}
            onPositionOpened={() => setRefreshPositions(prev => prev + 1)}
            positions={positions}
            handleClosePosition={handleClosePosition}
            closingPositionId={closingPositionId}
          />
        )}
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-xs md:text-sm text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  )
}

function MarketCard({ market, marketStats, index, onClick, isSelected }: { market: Market; marketStats?: MarketStats; index: number; onClick: () => void; isSelected: boolean }) {
  // Use dynamic prices if available, otherwise fall back to static prices
  const yesPrice = marketStats?.yesPrice ?? market.chance
  const noPrice = marketStats?.noPrice ?? (100 - market.chance)
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-all cursor-pointer",
        isSelected && "scale-105 z-50"
      )}
      style={{ animationDelay: `${index * 50} ms` }}
    >
      <div className="relative h-32 w-full overflow-hidden bg-gray-100">
        <img
          src={market.image}
          alt={market.title}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1">
          <Users className="w-3 h-3" />
          {market.volume}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-4">
        <div>
          <h3 className="font-medium text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {market.title}
          </h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-green-600">Yes {yesPrice.toFixed(1)}%</span>
            <span className="text-red-500">No {noPrice.toFixed(1)}%</span>
          </div>

          <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-1000 ease-out"
              style={{ width: `${yesPrice}% ` }}
            />
            <div
              className="absolute top-0 right-0 h-full bg-red-500 transition-all duration-1000 ease-out"
              style={{ width: `${noPrice}% ` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// --- MODAL COMPONENT (Smart Contract İşlemleri Burada) ---
function ExpandedMarketView({
  market,
  marketStats,
  onClose,
  leverage,
  setLeverage,
  wallets,
  authenticated,
  login,
  onPositionOpened,
  positions,
  handleClosePosition,
  closingPositionId
}: {
  market: Market;
  marketStats?: MarketStats;
  onClose: () => void;
  leverage: number;
  setLeverage: (val: number) => void;
  wallets: any[];
  authenticated: boolean;
  login: () => void;
  onPositionOpened: () => void;
  positions: Position[];
  handleClosePosition: (id: number) => Promise<void>;
  closingPositionId: number | null;
}) {
  // Use dynamic prices if available
  const yesPrice = marketStats?.yesPrice ?? market.chance
  const noPrice = marketStats?.noPrice ?? (100 - market.chance)
  const [chartData] = useState([65, 72, 68, 75, 70, 78, 82, 80, 85, 88, 90, 88, 92, 95, 93])
  const [isProcessing, setIsProcessing] = useState(false) // İşlem durumu
  const [txHash, setTxHash] = useState<string | null>(null) // Transaction hash
  const [txSuccess, setTxSuccess] = useState(false) // Success state
  const [tradeAmount, setTradeAmount] = useState<string>("10") // USDC amount to spend
  const [tradeMode, setTradeMode] = useState<'BUY' | 'SELL'>('BUY') // Buy or Sell mode
  const [openedPositionId, setOpenedPositionId] = useState<number | null>(null) // Newly opened position ID

  // --- TRADE FUNCTION ---
  const handleTrade = async (side: 'YES' | 'NO') => {
    console.log("handleTrade called with side:", side)
    if (!authenticated) {
      console.log("User not authenticated, calling login()")
      login()
      return
    }

    const wallet = wallets[0]
    console.log("Wallet found:", wallet ? wallet.address : "No wallet")
    if (!wallet) return alert("No wallet connected")

    setIsProcessing(true)
    console.log("Processing started...")
    try {
      // Switch to Arc Testnet if needed
      await wallet.switchChain(5042002)

      const ethereumProvider = await wallet.getEthereumProvider()
      const provider = new ethers.BrowserProvider(ethereumProvider)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      // Teminat Hesaplama - Amount based
      const amount = parseFloat(tradeAmount) || 10
      let collateralAmount

      if (leverage > 1) {
        // Perpetual işlem: User-specified collateral
        collateralAmount = ethers.parseUnits(amount.toFixed(6), 6)
      } else {
        // Spot işlem: User pays the full amount
        collateralAmount = ethers.parseUnits(amount.toFixed(6), 6)
      }

      // Fiyat Hesabı (Yüzdeyi 0-100 arası tam sayı olarak gönderiyoruz)
      // Ethers.js requires integers for uint256
      const entryPrice = Math.floor(side === 'YES' ? yesPrice : noPrice)

      console.log("Sending tx with:", {
        marketId: market.title,
        isLongYes: side === 'YES',
        entryPrice,
        leverage,
        collateralAmount: collateralAmount.toString()
      })

      // İşlemi Gönder
      const tx = await contract.openPosition(
        market.title, // Market ID olarak başlığı kullanıyoruz
        side === 'YES',
        entryPrice,
        leverage, // Kaldıraç parametresi
        { value: collateralAmount } // Native USDC gönderimi
      )

      console.log("TX Hash:", tx.hash)
      setTxHash(tx.hash) // Store the transaction hash

      await tx.wait() // Onayı bekle

      setTxSuccess(true) // Mark as successful

      // Get the position ID from transaction receipt (simplified - would need event parsing)
      // For now, we'll fetch the next position ID after a short delay
      setTimeout(async () => {
        try {
          const nextId = await contract.nextPositionId()
          const posId = Number(nextId) - 1
          console.log("Position ID:", posId) // Debug
          setOpenedPositionId(posId) // The position we just opened
        } catch (e) {
          console.error("Failed to get position ID:", e)
        }
      }, 1000)

      onPositionOpened() // Refresh positions after trade

    } catch (error: any) {
      console.error("Trade failed:", error)
      alert("Transaction failed: " + (error.reason || error.message))
      setTxHash(null)
      setTxSuccess(false)
    } finally {
      setIsProcessing(false)
    }
  }

  // Chart Logic (SVG)
  const chartWidth = 600
  const chartHeight = 200
  const padding = 20
  const dataPoints = chartData.length
  const stepX = (chartWidth - padding * 2) / (dataPoints - 1)
  const maxValue = Math.max(...chartData)
  const minValue = Math.min(...chartData)
  const range = maxValue - minValue || 1

  const points = chartData.map((value, i) => {
    const x = padding + i * stepX
    const y = chartHeight - padding - ((value - minValue) / range) * (chartHeight - padding * 2)
    return `${x},${y} `
  }).join(' ')

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[85vh] bg-card border border-border rounded-xl overflow-hidden shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-4 md:p-6 overflow-y-auto max-h-[85vh]">
          <div className="mb-4">
            <h1 className="text-xl md:text-2xl font-bold mb-2 line-clamp-2">{market.title}</h1>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-full">
                <Users className="w-3 h-3" />
                {market.volume}
              </div>
              <div className="bg-secondary px-2 py-1 rounded-full">
                {market.category}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column - Chart */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Price Chart</h2>
                </div>
                <div className="relative">
                  <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight} `} className="overflow-visible">
                    <path
                      d={`M ${points} `}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-green-600"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-green-600">Yes {yesPrice.toFixed(1)}%</span>
                  <span className="text-lg font-bold text-red-500">No {noPrice.toFixed(1)}%</span>
                </div>
                <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="absolute top-0 left-0 h-full bg-green-500" style={{ width: `${yesPrice}% ` }} />
                  <div className="absolute top-0 right-0 h-full bg-red-500" style={{ width: `${noPrice}% ` }} />
                </div>
                {marketStats && marketStats.totalVolume > 0 && (
                  <div className="text-xs text-muted-foreground mt-2 text-center">
                    💹 Live price • {marketStats.totalVolume.toFixed(2)} USDC volume
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Controls */}
            <div className="space-y-4">
              {/* Buy / Sell Tabs */}
              <div className="flex bg-secondary/30 rounded-lg p-1 mb-4">
                <button
                  onClick={() => setTradeMode('BUY')}
                  className={cn(
                    "flex-1 py-2 text-sm font-bold rounded-md transition-all",
                    tradeMode === 'BUY' ? "bg-green-600 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Buy
                </button>
                <button
                  onClick={() => setTradeMode('SELL')}
                  className={cn(
                    "flex-1 py-2 text-sm font-bold rounded-md transition-all",
                    tradeMode === 'SELL' ? "bg-red-500 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sell
                </button>
              </div>

              {tradeMode === 'BUY' ? (
                /* BUY MODE CONTENT */
                <>
                  {/* Amount Input - Polymarket Style */}
                  <div className="bg-secondary/20 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="text-sm font-semibold mb-2 block">Amount (USDC)</label>
                      <input
                        type="number"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        min="1"
                        step="1"
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="10"
                      />
                    </div>

                    {/* Leverage Toggle */}
                    <div className="bg-secondary/30 rounded-md p-1 flex gap-1">
                      <button
                        onClick={() => setLeverage(1)}
                        className={cn(
                          "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                          leverage === 1 ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Spot (1x)
                      </button>
                      <button
                        onClick={() => setLeverage(2)}
                        className={cn(
                          "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                          leverage > 1 ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Pro Leverage
                      </button>
                    </div>

                    {leverage > 1 && (
                      <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            🚀 Multiplier
                          </h3>
                          <span className="text-xl font-bold text-primary">{leverage}x</span>
                        </div>
                        <input
                          type="range" min="2" max="5" step="1"
                          value={leverage}
                          onChange={(e) => setLeverage(parseInt(e.target.value))}
                          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-foreground"
                        />
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                          <span>2x</span><span>5x</span>
                        </div>
                      </div>
                    )}

                    {/* Calculations */}
                    <div className="mt-3 space-y-1.5 text-xs border-t border-border/50 pt-3">
                      {(() => {
                        const amount = parseFloat(tradeAmount) || 10
                        const price = yesPrice / 100 // Convert to decimal
                        const shares = amount / price
                        const maxPayout = shares
                        const potentialProfit = maxPayout - amount

                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Avg Price</span>
                              <span className="font-medium">${price.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Shares</span>
                              <span className="font-medium">{shares.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Max Payout</span>
                              <span className="font-medium text-green-600">${maxPayout.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-1 font-bold text-sm border-t border-border/30">
                              <span>Potential Profit</span>
                              <span className={potentialProfit >= 0 ? "text-green-600" : "text-red-500"}>
                                ${potentialProfit.toFixed(2)}
                              </span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {txSuccess && txHash ? (
                      <div className="bg-green-500/10 border border-green-500 rounded-lg p-4 space-y-2 animate-fade-in">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-bold">Position Opened!</span>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="text-muted-foreground">Transaction Hash:</div>
                          <a
                            href={`https://testnet.arcscan.app/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-green-600 hover:text-green-700 font-mono break-all"
                          >
                            {txHash.slice(0, 10)}...{txHash.slice(-8)}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a >
                        </div >
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={onClose}
                            className="flex-1 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
                          >
                            Done
                          </button>
                          {openedPositionId && (
                            <button
                              onClick={async () => {
                                setTxSuccess(false)
                                setTxHash(null)
                                await handleClosePosition(openedPositionId)
                                setOpenedPositionId(null)
                                onClose()
                              }}
                              className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                              disabled={closingPositionId === openedPositionId}
                            >
                              {closingPositionId === openedPositionId ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Closing...
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4" />
                                  Close Position
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div >
                    ) : (
                      <>
                        <button
                          onClick={() => handleTrade('YES')}
                          disabled={isProcessing}
                          className="w-full p-3 rounded-lg bg-green-500/10 border-2 border-green-500 hover:bg-green-500/20 transition-all disabled:opacity-50"
                        >
                          <div className="flex items-center justify-center gap-2 mb-1">
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-green-600" /> : <TrendingUpIcon className="w-4 h-4 text-green-600" />}
                            <span className="text-sm font-bold text-green-600">
                              {isProcessing ? "Processing..." : "Buy YES"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">{yesPrice.toFixed(1)}%</div>
                        </button>

                        <button
                          onClick={() => handleTrade('NO')}
                          disabled={isProcessing}
                          className="w-full p-3 rounded-lg bg-red-500/10 border-2 border-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          <div className="flex items-center justify-center gap-2 mb-1">
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                            <span className="text-sm font-bold text-red-500">
                              {isProcessing ? "Processing..." : "Buy NO"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">{noPrice.toFixed(1)}%</div>
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* SELL MODE CONTENT */
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Your Positions</h3>
                  {positions.filter(p => p.marketId === market.title).length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {positions.filter(p => p.marketId === market.title).map((pos) => (
                        <div key={pos.id} className="bg-secondary/20 border border-border rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <div className={cn("font-bold text-sm", pos.isLongYes ? "text-green-600" : "text-red-500")}>
                              {pos.isLongYes ? "YES" : "NO"} Shares
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {Number(ethers.formatUnits(pos.collateral, 6)).toFixed(2)} USDC Collateral
                            </div>
                          </div>
                          <button
                            onClick={() => handleClosePosition(pos.id)}
                            disabled={closingPositionId === pos.id}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-md transition-colors flex items-center gap-1"
                          >
                            {closingPositionId === pos.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Sell"
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm bg-secondary/10 rounded-lg border border-dashed border-border">
                      You have no open positions in this market.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}