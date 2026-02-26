"use client";

import React, { use } from "react";
import Link from "next/link";

export default function PublicChurchPage({ params }: { params: Promise<{ subdomain: string; slug: string }> }) {
  const { subdomain, slug } = use(params);

  return (
    <div className="min-h-screen bg-white font-sans antialiased text-slate-900">
      {/* Dynamic Header */}
      <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link href={`/${subdomain}`} className="font-black text-2xl tracking-tight text-indigo-600 uppercase">
          {subdomain} Church
        </Link>
        <nav className="hidden md:flex space-x-8 text-sm font-semibold text-gray-600 uppercase tracking-wide">
          <Link href={`/${subdomain}`} className="hover:text-black cursor-pointer transition-colors">Home</Link>
          <span className={`${slug === 'about' ? 'text-indigo-600' : 'hover:text-black'} cursor-pointer transition-colors`}>About</span>
          <span className="hover:text-black cursor-pointer transition-colors">Events</span>
          <button className="px-6 py-2 rounded-full bg-indigo-600 text-white text-xs font-bold transition-transform hover:scale-105">
            Give Online
          </button>
        </nav>
      </header>

      {/* Page Content */}
      <main className="max-w-4xl mx-auto px-8 py-24 space-y-12">
        <h1 className="text-5xl font-black tracking-tight text-slate-900 capitalize border-l-8 border-indigo-600 pl-6">
          {slug.replace('-', ' ')}
        </h1>
        
        <div className="prose prose-indigo prose-lg text-slate-600 leading-relaxed max-w-none">
          <p>
            Welcome to the <strong>{slug.replace('-', ' ')}</strong> page for {subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} Church.
          </p>
          <p>
            This is a dynamic placeholder page. In the final version, this content will be populated directly from our Website Builder database.
          </p>
          <div className="bg-slate-50 p-10 rounded-3xl border border-slate-100 my-10">
             <h3 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">Stay Tuned!</h3>
             <p className="text-sm">We are currently updating this section with new information about our community and ministries.</p>
          </div>
        </div>

        <Link 
          href={`/${subdomain}`}
          className="inline-flex items-center text-indigo-600 font-black text-sm uppercase tracking-widest hover:translate-x-1 transition-transform"
        >
          <span>Back to Home</span>
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </Link>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 py-20 text-white mt-24">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-slate-800 pb-12">
          <div className="md:col-span-2 text-center md:text-left">
            <div className="font-black text-2xl mb-6 tracking-tighter">{subdomain.toUpperCase()} CHURCH</div>
            <p className="text-slate-400 max-w-sm leading-relaxed mx-auto md:mx-0">
              Linking people to God and each other. We believe that everyone has a place here.
            </p>
          </div>
          <div className="text-center md:text-left">
            <h4 className="font-black mb-6 text-indigo-400 uppercase tracking-widest text-[10px]">Quick Links</h4>
            <ul className="space-y-4 text-sm text-slate-300 font-bold">
              <li className="hover:text-white cursor-pointer transition-colors">About Us</li>
              <li className="hover:text-white cursor-pointer transition-colors">Ministries</li>
              <li className="hover:text-white cursor-pointer transition-colors">Contact</li>
            </ul>
          </div>
          <div className="text-center md:text-left">
            <h4 className="font-black mb-6 text-indigo-400 uppercase tracking-widest text-[10px]">Contact</h4>
            <p className="text-sm text-slate-300 leading-loose font-bold">
              123 Faith Blvd<br />
              Grace City, GC 56789<br />
              hello@{subdomain}.com
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 pt-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-500 font-black uppercase tracking-widest gap-6">
           <span>© 2026 {subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} Church. All rights reserved.</span>
           <span className="flex items-center">
             Powered by <span className="text-white ml-1">Noxera Plus</span>
           </span>
        </div>
      </footer>
    </div>
  );
}
