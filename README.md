# 💧 DRIP — Creator Fee Redistribution Protocol

> **What if creator fees came back to YOU?**

DRIP is an open-source bot that automatically redistributes pump.fun creator fees to token holders based on their **loyalty score**.

---

## 🧠 How It Works

```
Trading Volume → Creator Fees Generated → DRIP Bot Claims Fees
→ Calculates Holder Scores → Redistributes SOL to Diamond Hands
→ Repeat Every Hour 💧
```

### The DRIP Score Algorithm

Not all holders are equal. DRIP rewards **loyalty over size**:

| Factor | How It Works |
|--------|-------------|
| 🕐 **Hold Duration** | The longer you hold, the higher your multiplier (0.1x → 2.0x) |
| 📊 **Hold Amount** | Your % of supply, but **capped at 3%** — whales don't dominate |
| 🛡️ **Loyalty Check** | Sold more than 50% of your bag? **Disqualified** from drip |

#### Duration Multipliers

| Hold Time | Multiplier | Tier |
|-----------|-----------|------|
| < 1 hour | 0.1x | 🏃 Sniper |
| 1-6 hours | 0.5x | 🚶 Tourist |
| 6-24 hours | 1.0x | 💪 Believer |
| 24-72 hours | 1.5x | 💎 Diamond |
| 72+ hours | 2.0x | 👑 OG |

### Example

Two holders of $DRIP:
- **Holder A**: Owns 1% of supply, holding for 48 hours → Score: 1.0 × 1.5 = **1.5**
- **Holder B**: Owns 5% of supply (capped at 3%), holding for 2 hours → Score: 3.0 × 0.5 = **1.5**

Both get equal drip. The small guy who holds longer gets as much as the whale who just bought.

---

## ⚡ Quick Start

```bash
git clone https://github.com/YOUR_HANDLE/drip-bot.git
cd drip-bot
npm install
cp .env.example .env
# Edit .env with your keys
node drip-bot.js --once    # Single drip cycle
node drip-bot.js --once --dry-run   # Test without sending SOL
node drip-bot.js --loop   # Auto-drip every hour
```

**Premiers tests (APIs + dry-run) :** voir [TESTING.md](./TESTING.md).

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   pump.fun      │────▶│ DRIP Treasury│────▶│   Holders    │
│  Creator Fees   │     │   Wallet     │     │  (scored)    │
│   (0.95%)       │     │   Claims &   │     │              │
│                 │     │ Distributes  │     │  💧 SOL drip │
└─────────────────┘     └──────────────┘     └──────────────┘
         │                      │
         │              ┌──────────────┐
         │              │  DRIP Score  │
         └─────────────▶│  Calculator  │
                        │              │
                        │ • Duration   │
                        │ • Amount     │
                        │ • Loyalty    │
                        └──────────────┘
```

**Treasury Wallet**: 100% of creator fees go to a public treasury wallet. Anyone can verify on-chain that NO fees go to the dev.

---

## 📊 DRIP Dashboard

Every drip cycle generates a public report:
- Total SOL distributed
- Number of recipients  
- Top 5 earners (wallet snippets)
- On-chain TX proof
- Running total of all-time distributions

---

## 🗺️ Roadmap

- [x] V1: Basic claim + redistribute bot
- [ ] V2: Live dashboard with real-time drip tracking
- [ ] V3: Telegram/Discord notifications when you receive drip
- [ ] V4: Multi-token support (any pump.fun token can use DRIP)
- [ ] V5: On-chain DRIP Score (verifiable, transparent)

---

## 💡 Why DRIP?

98.6% of pump.fun tokens are rugs. Creator fees go straight to the dev wallet.

**DRIP flips the script**: fees go back to the community. The longer you believe, the more you earn.

> *"Diamond hands get the drip"* 💧💎

---

## 📜 License

MIT — Open source, free to use, fork, and improve.

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Not financial advice.
