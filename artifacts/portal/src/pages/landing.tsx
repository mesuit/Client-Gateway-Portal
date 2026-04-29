import { Link } from "wouter";
import { Smartphone, Shield, Zap, Code2, ArrowRight, CheckCircle, Globe, Lock, BarChart3 } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Instant STK Push",
    desc: "Trigger M-Pesa payment prompts programmatically. Customers pay with their PIN — no redirects, no friction.",
  },
  {
    icon: Globe,
    title: "Payment Links",
    desc: "Generate shareable payment links in seconds. Share via WhatsApp, SMS, or embed on your site.",
  },
  {
    icon: Shield,
    title: "Direct to Your Till",
    desc: "Money lands straight in your M-Pesa till. No middleman holding your funds. No delays.",
  },
  {
    icon: Code2,
    title: "Simple REST API",
    desc: "Clean JSON API. Integrate in minutes with any language — PHP, Node.js, Python, or plain curl.",
  },
  {
    icon: BarChart3,
    title: "Live Dashboard",
    desc: "Track every transaction in real time. Filter, export, and understand your payment flow.",
  },
  {
    icon: Lock,
    title: "Secure API Keys",
    desc: "Scoped secret keys per integration. Revoke instantly if compromised. Your credentials are safe.",
  },
];

const STEPS = [
  { n: "01", title: "Create an account", desc: "Register in under 2 minutes. No paperwork, no waiting." },
  { n: "02", title: "Add your M-Pesa Till", desc: "Link your Buy Goods till number. Funds go directly to you." },
  { n: "03", title: "Get your API key", desc: "Generate a secret key and start accepting payments immediately." },
];

const CODE_EXAMPLE = `curl -X POST https://pay.makamesco-tech.co.ke/api/payments/stkpush \\
  -H "X-API-Key: sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 500,
    "accountReference": "ORDER-001",
    "transactionDesc": "Payment for order"
  }'`;

export default function Landing() {
  const isHeistTech = typeof window !== "undefined" && window.location.hostname.includes("heisttech");
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt={isHeistTech ? "HeistTech Pay" : "Nexus Pay"} className="w-9 h-9 rounded-xl object-contain" />
            <div>
              <span className="font-bold text-gray-900">{isHeistTech ? "HeistTech Pay" : "Nexus Pay"}</span>
              {!isHeistTech && <span className="hidden sm:inline text-xs text-gray-400 ml-1">by Makamesco</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-green-50 via-white to-white">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live M-Pesa Gateway · Daraja API
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-gray-900 leading-tight">
            Accept M-Pesa payments{" "}
            <span className="text-green-600">with a single API call</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            {isHeistTech
              ? "HeistTech Enterprise Pay gives businesses a clean REST API to trigger STK Push payments, create payment links, and route money directly to their M-Pesa till — no agents, no delays."
              : "Nexus Pay gives Kenyan businesses a clean REST API to trigger STK Push payments, create payment links, and route money directly to their M-Pesa till — no agents, no delays."}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-md"
            >
              Start for free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-8 py-4 rounded-xl text-base transition-colors"
            >
              <Code2 className="w-5 h-5" /> Read the docs
            </Link>
          </div>

          <div className="flex flex-wrap gap-6 justify-center pt-4 text-sm text-gray-400">
            {["No setup fees", "Real M-Pesa integration", "Funds go straight to your till"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Code sample */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-700">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-3 text-xs text-gray-400 font-mono">STK Push — one API call</span>
            </div>
            <pre className="p-4 sm:p-6 text-xs sm:text-sm text-green-300 font-mono overflow-x-auto leading-relaxed">
              {CODE_EXAMPLE}
            </pre>
          </div>
          <p className="text-center text-sm text-gray-400 mt-4">
            That's it. Customer gets an M-Pesa prompt. Money hits your till.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Everything you need</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Built for Kenyan developers and businesses who want reliable M-Pesa integration without the complexity.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-green-200 hover:shadow-md transition-all">
                <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Up and running in minutes</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center space-y-3">
                <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mx-auto">
                  <span className="text-white font-black text-lg">{n}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-green-600">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Start accepting M-Pesa payments today
          </h2>
          <p className="text-green-100 text-lg">
            Join businesses using Nexus Pay to collect payments with a modern, developer-friendly API.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-green-700 font-bold px-8 py-4 rounded-xl text-base hover:bg-green-50 transition-colors shadow-lg"
          >
            Create free account <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xs">{isHeistTech ? "H" : "N"}</span>
            </div>
            <span>{isHeistTech ? "HeistTech Enterprise Pay" : "Nexus Pay · Makamesco Tech"}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/docs" className="hover:text-gray-700 transition-colors">Documentation</Link>
            <Link href="/login" className="hover:text-gray-700 transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-gray-700 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
