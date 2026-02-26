"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

export type PortalLink = {
  label: string;
  href: string;
  description: string;
  icon: React.ReactNode;
};

export function PortalSwitcher({
  links,
  isDarkMode,
}: {
  links: PortalLink[];
  isDarkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  if (links.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Open portal links"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
          isDarkMode
            ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m7-7H5" />
        </svg>
        Portals
      </button>

      {open && (
        <div className={`absolute right-0 top-12 z-50 w-72 rounded-2xl border shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <div className={`border-b px-4 py-3 ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}>
            <p className={`text-xs font-black ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Portal Quick Links</p>
            <p className={`mt-1 text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Navigate across the platform quickly.</p>
          </div>
          <div className="p-2">
            {links.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 rounded-xl px-3 py-2 transition ${isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
              >
                <span className={`mt-0.5 ${isDarkMode ? "text-indigo-300" : "text-indigo-600"}`}>{link.icon}</span>
                <span>
                  <span className={`block text-xs font-black ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{link.label}</span>
                  <span className={`block text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{link.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
