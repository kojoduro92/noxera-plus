"use client";

import React, { useState, useEffect } from "react";

export default function WebsiteBuilderPage() {
  const [website, setWebsite] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, fetch the website data from the API
    // fetch('/api/website', { headers: { 'x-tenant-id': 'current-tenant-id' } })
    //   .then(res => res.json())
    //   .then(data => { setWebsite(data); setLoading(false); });

    // Mock data for initial UI
    setWebsite({
      themeConfig: { primaryColor: "#4f46e5", font: "Inter", domain: "grace.noxera.plus" },
      pages: [
        { id: "1", slug: "home", title: "Home", isPublished: true },
        { id: "2", slug: "about", title: "About Us", isPublished: true },
      ],
    });
    setLoading(false);
  }, []);

  const updateTheme = (key: string, value: string) => {
    setWebsite({
      ...website,
      themeConfig: { ...website.themeConfig, [key]: value },
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Website Builder</h2>
        <div className="space-x-4">
          <button className="text-indigo-600 font-medium hover:text-indigo-800">Preview Site</button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium">
            Publish Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Sidebar: Theme & Pages */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 border-b pb-2">Global Branding</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Brand Color</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={website.themeConfig.primaryColor}
                    onChange={(e) => updateTheme("primaryColor", e.target.value)}
                    className="h-10 w-10 rounded-md cursor-pointer border border-gray-200 p-1"
                  />
                  <code className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded">{website.themeConfig.primaryColor}</code>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Typography</label>
                <select 
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={website.themeConfig.font}
                  onChange={(e) => updateTheme("font", e.target.value)}
                >
                  <option>Inter</option>
                  <option>Roboto</option>
                  <option>Open Sans</option>
                  <option>Playfair Display</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Public Address</label>
                <input
                  type="text"
                  value={website.themeConfig.domain}
                  readOnly
                  className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm sm:text-sm text-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Site Pages</h3>
              <button className="text-indigo-600 text-sm font-medium hover:underline">+ New Page</button>
            </div>
            <ul className="space-y-1">
              {website.pages.map((page: any) => (
                <li 
                  key={page.id} 
                  className="group flex justify-between items-center p-3 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <span className="font-medium text-gray-800">{page.title}</span>
                    <p className="text-xs text-gray-400">/{page.slug}</p>
                  </div>
                  <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-gray-400 hover:text-indigo-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button className="text-gray-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-[700px] overflow-hidden">
            <div className="bg-gray-800 p-3 flex items-center space-x-2">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="flex-1 px-4 py-1.5 mx-8 bg-gray-700 rounded text-gray-300 text-xs text-center truncate">
                https://{website.themeConfig.domain}
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-white" style={{ fontFamily: website.themeConfig.font }}>
              {/* Header Preview */}
              <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                <div className="font-black text-xl tracking-tight" style={{ color: website.themeConfig.primaryColor }}>
                  CHURCH LOGO
                </div>
                <nav className="flex space-x-6 text-sm font-medium text-gray-600">
                  <span className="hover:text-black cursor-pointer">Home</span>
                  <span className="hover:text-black cursor-pointer">About</span>
                  <span className="hover:text-black cursor-pointer">Ministries</span>
                  <button className="px-4 py-1.5 rounded-full text-white text-xs font-bold transition-transform hover:scale-105" style={{ backgroundColor: website.themeConfig.primaryColor }}>
                    Give
                  </button>
                </nav>
              </header>

              {/* Hero Section Preview */}
              <section className="px-8 py-20 bg-gray-50 flex flex-col items-center text-center">
                <h1 className="text-5xl font-extrabold text-gray-900 mb-6 leading-tight max-w-2xl">
                  A Place for You to <span style={{ color: website.themeConfig.primaryColor }}>Belong</span>
                </h1>
                <p className="text-lg text-gray-600 mb-10 max-w-xl">
                  Join us for worship and community every Sunday at 9:00 AM and 11:30 AM. We can\'t wait to meet you!
                </p>
                <div className="flex space-x-4">
                  <button className="px-8 py-3 rounded-md text-white font-bold shadow-lg" style={{ backgroundColor: website.themeConfig.primaryColor }}>
                    Plan a Visit
                  </button>
                  <button className="px-8 py-3 rounded-md bg-white border-2 text-gray-900 font-bold" style={{ borderColor: website.themeConfig.primaryColor }}>
                    Watch Online
                  </button>
                </div>
              </section>

              {/* Ministries Grid Preview */}
              <section className="px-8 py-16">
                <h2 className="text-2xl font-bold text-center mb-12">Our Ministries</h2>
                <div className="grid grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 group hover:border-indigo-200 transition-colors">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-white rounded-full mx-auto mb-3 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                           <svg className="w-5 h-5" style={{ color: website.themeConfig.primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ministry {i}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
