import Image from 'next/image';
import LiveDashboard from '@/components/LiveDashboard';

const PUMP_URL = process.env.NEXT_PUBLIC_PUMP_FUN_URL || 'https://pump.fun';
const TOKEN_CA = process.env.NEXT_PUBLIC_TOKEN_MINT || 'YOUR_TOKEN_CA';
const TOKEN_SUPPLY = process.env.NEXT_PUBLIC_TOKEN_SUPPLY || '1,000,000,000';
const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/metaversebroly/drip-bot';
const X_URL = process.env.NEXT_PUBLIC_X_URL || 'https://x.com';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.08)_0%,transparent_70%)]" />
        <div className="relative z-10 text-center w-full max-w-4xl">
          <Image
            src="/header.png"
            alt="PepeDrip — Reward Holders"
            width={1500}
            height={500}
            priority
            className="w-full h-auto rounded-xl shadow-neon mb-8"
          />
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-10">
            Pump.fun rewards flippers. We reward holders.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={PUMP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-neon text-dark-900 font-bold rounded-xl hover:shadow-neon transition-all hover:scale-105"
            >
              Buy on pump.fun
            </a>
            <a
              href="#dashboard"
              className="px-8 py-4 border-2 border-neon text-neon font-bold rounded-xl hover:bg-neon/10 transition-all"
            >
              Dashboard
            </a>
          </div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="py-20 px-4 bg-dark-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">The Problem</h2>
          <p className="text-gray-400 mb-10 text-lg">
            Pump.fun Cashback rewards traders who spam buy & sell. Bots win. Holders lose.
          </p>
          <div className="overflow-x-auto rounded-xl border border-dark-600">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-dark-700">
                  <th className="p-4 text-gray-400 font-medium"></th>
                  <th className="p-4 text-red-400 font-medium">Pump.fun Cashback</th>
                  <th className="p-4 text-neon font-medium">PepeDrip</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-t border-dark-600">
                  <td className="p-4 font-medium">Who gets rewarded?</td>
                  <td className="p-4">Traders (buy & sell volume)</td>
                  <td className="p-4 text-neon">Holders (loyalty score)</td>
                </tr>
                <tr className="border-t border-dark-600">
                  <td className="p-4 font-medium">Bots benefit?</td>
                  <td className="p-4">Yes — they spam trades</td>
                  <td className="p-4 text-neon">No — need to hold</td>
                </tr>
                <tr className="border-t border-dark-600">
                  <td className="p-4 font-medium">Frequency</td>
                  <td className="p-4">Claim manually on mobile app</td>
                  <td className="p-4 text-neon">Auto every 30 min</td>
                </tr>
                <tr className="border-t border-dark-600">
                  <td className="p-4 font-medium">Fair distribution?</td>
                  <td className="p-4">Whales dominate</td>
                  <td className="p-4 text-neon">Capped at 2% per wallet</td>
                </tr>
                <tr className="border-t border-dark-600">
                  <td className="p-4 font-medium">Sell your bag?</td>
                  <td className="p-4">Still get cashback</td>
                  <td className="p-4 text-neon">Disqualified</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-gray-400 mb-12">
            Four simple steps. The longer you hold, the more you earn.
          </p>

          <div className="grid md:grid-cols-4 gap-6 mb-16">
            {['Buy', 'Hold', 'Score', 'Drip'].map((step, i) => (
              <div key={step} className="relative">
                <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 text-center hover:border-neon/50 transition-colors">
                  <span className="inline-block w-10 h-10 rounded-full bg-neon/20 text-neon font-bold flex items-center justify-center mx-auto mb-3">
                    {i + 1}
                  </span>
                  <h3 className="text-xl font-bold text-white">{step}</h3>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-neon/50" />
                )}
              </div>
            ))}
          </div>

          <h3 className="text-xl font-bold text-neon mb-4">Duration Multipliers</h3>
          <p className="text-gray-500 mb-6">Hold longer = higher multiplier = more SOL per drip</p>
          <div className="overflow-x-auto rounded-xl border border-dark-600">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-700">
                  <th className="p-4 text-left text-gray-400">Hold Time</th>
                  <th className="p-4 text-left text-gray-400">Multiplier</th>
                  <th className="p-4 text-left text-gray-400">Tier</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-t border-dark-600"><td className="p-4">&lt; 30 min</td><td className="p-4">0.1x</td><td className="p-4">🏃 Sniper</td></tr>
                <tr className="border-t border-dark-600"><td className="p-4">30 min - 2h</td><td className="p-4">0.5x</td><td className="p-4">🚶 Tourist</td></tr>
                <tr className="border-t border-dark-600"><td className="p-4">2h - 6h</td><td className="p-4">1.0x</td><td className="p-4">💪 Believer</td></tr>
                <tr className="border-t border-dark-600"><td className="p-4">6h - 24h</td><td className="p-4">1.5x</td><td className="p-4">💎 Diamond</td></tr>
                <tr className="border-t border-dark-600"><td className="p-4">24h+</td><td className="p-4">2.0x</td><td className="p-4">👑 OG</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* LIVE DASHBOARD */}
      <LiveDashboard />

      {/* TOKENOMICS */}
      <section className="py-20 px-4 bg-dark-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">Tokenomics</h2>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-8 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Supply</span>
              <span className="text-neon font-mono">{TOKEN_SUPPLY}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Contract</span>
              <span className="text-gray-400 font-mono text-sm break-all">{TOKEN_CA}</span>
            </div>
            <div className="pt-4 flex gap-4">
              <a
                href={PUMP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon hover:underline"
              >
                pump.fun →
              </a>
              <a
                href={`https://solscan.io/token/${TOKEN_CA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon hover:underline"
              >
                Solscan →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-10">Roadmap</h2>
          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <span className="w-8 h-8 rounded-full bg-neon/20 text-neon flex items-center justify-center flex-shrink-0 font-bold">1</span>
              <div>
                <h3 className="text-lg font-bold text-white">Phase 1: Launch + Bot Live</h3>
                <p className="text-gray-500">Token launch, DRIP bot running 24/7 on Railway</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="w-8 h-8 rounded-full bg-neon/20 text-neon flex items-center justify-center flex-shrink-0 font-bold">2</span>
              <div>
                <h3 className="text-lg font-bold text-white">Phase 2: Dashboard Public</h3>
                <p className="text-gray-500">Live dashboard with real-time drip tracking</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="w-8 h-8 rounded-full bg-dark-600 text-gray-500 flex items-center justify-center flex-shrink-0 font-bold">3</span>
              <div>
                <h3 className="text-lg font-bold text-gray-400">Phase 3: Multi-token Support</h3>
                <p className="text-gray-500">Any pump.fun token can use DRIP</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-4 border-t border-dark-600">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8">
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-neon transition-colors">
            X
          </a>
          <a href={PUMP_URL} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-neon transition-colors">
            pump.fun
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-neon transition-colors">
            GitHub
          </a>
        </div>
        <p className="text-center text-gray-600 text-sm mt-6">PepeDrip — Diamond hands get the drip 💧</p>
      </footer>
    </main>
  );
}
