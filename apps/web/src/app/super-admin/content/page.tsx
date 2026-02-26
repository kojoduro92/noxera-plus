"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, withJsonBody } from "@/lib/api-client";

type TemplateCard = {
  id: string;
  name: string;
  status: string;
};

type ResourceLink = {
  id: string;
  title: string;
  slug: string;
};

type ContentHubSettings = {
  globalAnnouncementEnabled: boolean;
  globalAnnouncement: {
    title: string;
    body: string;
    severity: string;
  };
  templateLibrary: TemplateCard[];
  spotlightArticles: ResourceLink[];
};

export default function ContentHubPage() {
  const [settings, setSettings] = useState<ContentHubSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch<ContentHubSettings>("/api/super-admin/settings/content", { cache: "no-store" });
      setSettings(payload);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to load content hub settings.");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/api/super-admin/settings/content", {
        method: "PATCH",
        ...withJsonBody(settings),
      });
      setMessage("Content hub settings saved.");
      await loadSettings();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to save content settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Content Governance</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Global Content Hub</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Control global announcements, template visibility, and editorial spotlight links.</p>
      </section>

      {(error || message) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      {loading || !settings ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : (
        <form onSubmit={saveSettings} className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Global Announcement</h3>
            <div className="mt-4 grid gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.globalAnnouncementEnabled}
                  onChange={(event) => setSettings((current) => current ? ({ ...current, globalAnnouncementEnabled: event.target.checked }) : current)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Announcement enabled
              </label>
              <input
                value={settings.globalAnnouncement.title}
                onChange={(event) => setSettings((current) => current ? ({ ...current, globalAnnouncement: { ...current.globalAnnouncement, title: event.target.value } }) : current)}
                placeholder="Announcement title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                value={settings.globalAnnouncement.body}
                onChange={(event) => setSettings((current) => current ? ({ ...current, globalAnnouncement: { ...current.globalAnnouncement, body: event.target.value } }) : current)}
                rows={4}
                placeholder="Announcement body"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={settings.globalAnnouncement.severity}
                onChange={(event) => setSettings((current) => current ? ({ ...current, globalAnnouncement: { ...current.globalAnnouncement, severity: event.target.value } }) : current)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Template Library</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Mark templates as published/draft to control marketplace visibility.</p>
            <div className="mt-4 grid gap-3">
              {settings.templateLibrary.map((template, index) => (
                <div key={template.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto]">
                  <input
                    value={template.name}
                    onChange={(event) => setSettings((current) => {
                      if (!current) return current;
                      const next = [...current.templateLibrary];
                      next[index] = { ...next[index], name: event.target.value };
                      return { ...current, templateLibrary: next };
                    })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={template.status}
                    onChange={(event) => setSettings((current) => {
                      if (!current) return current;
                      const next = [...current.templateLibrary];
                      next[index] = { ...next[index], status: event.target.value };
                      return { ...current, templateLibrary: next };
                    })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Spotlight Articles</h3>
            <div className="mt-4 grid gap-3">
              {settings.spotlightArticles.map((article, index) => (
                <div key={article.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr]">
                  <input
                    value={article.title}
                    onChange={(event) => setSettings((current) => {
                      if (!current) return current;
                      const next = [...current.spotlightArticles];
                      next[index] = { ...next[index], title: event.target.value };
                      return { ...current, spotlightArticles: next };
                    })}
                    placeholder="Article title"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={article.slug}
                    onChange={(event) => setSettings((current) => {
                      if (!current) return current;
                      const next = [...current.spotlightArticles];
                      next[index] = { ...next[index], slug: event.target.value };
                      return { ...current, spotlightArticles: next };
                    })}
                    placeholder="/docs/article"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </section>

          <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-60">
            {saving ? "Saving..." : "Save Content Settings"}
          </button>
        </form>
      )}
    </div>
  );
}
