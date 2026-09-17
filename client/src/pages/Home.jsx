import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gradient-to-b from-marigold/10 to-cream">
      <p className="text-clove text-xs uppercase tracking-widest mb-3">QR Restaurant Ordering</p>
      <h1 className="font-display text-4xl md:text-5xl max-w-xl mb-4">Scan. Order. Pay. Done.</h1>
      <p className="text-charcoal/60 max-w-md mb-8">
        A mobile-first ordering platform for restaurants. Customers scan a table QR to order and pay instantly;
        staff manage everything from a live dashboard.
      </p>
      <div className="flex gap-3">
        <Link to="/admin/login" className="btn-primary">Restaurant Login</Link>
        <Link to="/admin/register" className="btn-secondary">Set Up Your Restaurant</Link>
      </div>
    </div>
  );
}
