import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="restaurant-hero min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="glass-panel rounded-[32px] p-7 shadow-[0_30px_80px_rgba(15,19,16,0.55)] sm:p-10">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#F7C873]">QR Restaurant Ordering</p>
            <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
              Scan. Order. <span className="text-[#F9DFA2]">Pay.</span> Done.
            </h1>
            <p className="mt-5 max-w-xl text-base text-[#edf2ed]/80 sm:text-lg">
              A mobile-first ordering platform for modern restaurants. Guests scan a single QR code, order in seconds,
              and pay without waiting at the counter while staff manage everything from a live dashboard.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/admin/login" className="btn-primary inline-flex items-center justify-center">Restaurant Login</Link>
              <Link to="/admin/register" className="btn-secondary inline-flex items-center justify-center bg-white/10 text-white border-white/20 hover:bg-white/15">Set Up Your Restaurant</Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-xs text-[#edf2ed]/80">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2">Live orders</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2">Table QR</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2">Fast checkout</span>
            </div>
          </div>

          <div className="glass-card rounded-[30px] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#F7C873]">Today</p>
                <h2 className="mt-2 font-display text-3xl text-white">Chef&apos;s pick</h2>
              </div>
              <span className="rounded-full border border-[#F7C873]/40 bg-[#F7C873]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F9DFA2]">
                Open now
              </span>
            </div>

            <div className="restaurant-scene overflow-hidden rounded-2xl border border-white/10">
              <div className="restaurant-scene__lamp" />
              <div className="restaurant-scene__plate" />
              <div className="restaurant-scene__table" />
            </div>

            <div className="mt-5 space-y-3 text-sm text-[#edf2ed]/80">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span>Avg. wait time</span>
                <strong className="text-white">12 mins</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span>Table service</span>
                <strong className="text-white">Live</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span>Today&apos;s special</span>
                <strong className="text-white">Truffle Pasta</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
