"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";

type SectionRow = {
  id: string;
  type: string;
  order: number;
  content: Record<string, unknown> | null;
};

type PageRow = {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  sections: SectionRow[];
};

type WebsitePayload = {
  id: string;
  tenantId: string;
  themeConfig: Record<string, unknown> | null;
  pages: PageRow[];
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

export default function WebsiteBuilderPage() {
  const [website, setWebsite] = useState<WebsitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const [themePrimaryColor, setThemePrimaryColor] = useState("#4f46e5");
  const [themeFont, setThemeFont] = useState("Inter");
  const [themeLogoUrl, setThemeLogoUrl] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);

  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [creatingPage, setCreatingPage] = useState(false);

  const [sectionType, setSectionType] = useState("hero");
  const [sectionContent, setSectionContent] = useState('{"title":"New section"}');
  const [sectionOrder, setSectionOrder] = useState("0");
  const [addingSection, setAddingSection] = useState(false);

  const loadWebsite = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch<WebsitePayload>("/api/admin/website", { cache: "no-store" });
      setWebsite(payload);

      const config = payload.themeConfig ?? {};
      setThemePrimaryColor(typeof config.primaryColor === "string" ? config.primaryColor : "#4f46e5");
      setThemeFont(typeof config.font === "string" ? config.font : "Inter");
      setThemeLogoUrl(typeof config.logoUrl === "string" ? config.logoUrl : "");

      setSelectedPageId((current) => (current && payload.pages.some((page) => page.id === current) ? current : payload.pages[0]?.id ?? null));
    } catch (err) {
      setWebsite(null);
      setError(getErrorMessage(err, "Unable to load website configuration."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWebsite();
  }, [loadWebsite]);

  const selectedPage = useMemo(
    () => website?.pages.find((page) => page.id === selectedPageId) ?? website?.pages[0] ?? null,
    [selectedPageId, website?.pages],
  );

  const saveTheme = async () => {
    setSavingTheme(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("/api/admin/website/theme", {
        method: "PUT",
        ...withJsonBody({
          primaryColor: themePrimaryColor,
          font: themeFont,
          logoUrl: themeLogoUrl || null,
        }),
      });
      setNotice("Theme updated.");
      await loadWebsite();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update theme."));
    } finally {
      setSavingTheme(false);
    }
  };

  const rollbackThemeDraft = () => {
    if (!website) return;
    const config = website.themeConfig ?? {};
    setThemePrimaryColor(typeof config.primaryColor === "string" ? config.primaryColor : "#4f46e5");
    setThemeFont(typeof config.font === "string" ? config.font : "Inter");
    setThemeLogoUrl(typeof config.logoUrl === "string" ? config.logoUrl : "");
    setNotice("Reverted to last published theme snapshot.");
  };

  const createPage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPageSlug.trim() || !newPageTitle.trim()) {
      setError("Page slug and title are required.");
      return;
    }

    setCreatingPage(true);
    setError("");
    setNotice("");

    try {
      const payload = await apiFetch<PageRow>("/api/admin/website/pages", {
        method: "POST",
        ...withJsonBody({ slug: newPageSlug.trim(), title: newPageTitle.trim() }),
      });
      setNotice("Page created.");
      setNewPageSlug("");
      setNewPageTitle("");
      setSelectedPageId(payload.id);
      await loadWebsite();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create page."));
    } finally {
      setCreatingPage(false);
    }
  };

  const togglePublish = async () => {
    if (!selectedPage) return;
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/website/pages/${selectedPage.id}`, {
        method: "PUT",
        ...withJsonBody({ isPublished: !selectedPage.isPublished }),
      });
      setNotice(selectedPage.isPublished ? "Page unpublished." : "Page published.");
      await loadWebsite();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update page publish status."));
    }
  };

  const addSection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPage) {
      setError("Select a page first.");
      return;
    }

    let parsedContent: Record<string, unknown>;
    try {
      const parsed = JSON.parse(sectionContent) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("Section content must be a JSON object.");
        return;
      }
      parsedContent = parsed as Record<string, unknown>;
    } catch {
      setError("Section content must be valid JSON.");
      return;
    }

    const parsedOrder = Number.parseInt(sectionOrder, 10);
    if (!Number.isFinite(parsedOrder)) {
      setError("Section order must be a valid number.");
      return;
    }

    setAddingSection(true);
    setError("");
    setNotice("");

    try {
      await apiFetch(`/api/admin/website/pages/${selectedPage.id}/sections`, {
        method: "POST",
        ...withJsonBody({
          type: sectionType,
          order: parsedOrder,
          content: parsedContent,
        }),
      });
      setNotice("Section added.");
      await loadWebsite();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add section."));
    } finally {
      setAddingSection(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Website Builder</p>
        <h2 className="mt-2 text-2xl font-black">Manage church site branding, pages, and sections from real tenant data.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Use publish controls to release pages and keep a rollback path for theme draft edits.</p>
      </section>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Theme Settings</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Primary color</label>
              <input type="color" value={themePrimaryColor} onChange={(event) => setThemePrimaryColor(event.target.value)} className="h-10 w-16 rounded border border-slate-300" />
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Base font</label>
              <select value={themeFont} onChange={(event) => setThemeFont(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Playfair Display">Playfair Display</option>
              </select>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Logo URL</label>
              <input value={themeLogoUrl} onChange={(event) => setThemeLogoUrl(event.target.value)} placeholder="https://..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={savingTheme} onClick={() => void saveTheme()} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-60">
                {savingTheme ? "Saving..." : "Save Theme"}
              </button>
              <button type="button" onClick={rollbackThemeDraft} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700">
                Rollback Draft
              </button>
            </div>
          </div>

          <form onSubmit={createPage} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Create Page</h3>
            <div className="mt-4 grid gap-3">
              <input value={newPageTitle} onChange={(event) => setNewPageTitle(event.target.value)} placeholder="Page title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={newPageSlug} onChange={(event) => setNewPageSlug(event.target.value)} placeholder="page-slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <button type="submit" disabled={creatingPage} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-700 disabled:opacity-60">
              {creatingPage ? "Creating..." : "Create Page"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Pages & Sections</h3>
            <button type="button" onClick={() => void loadWebsite()} className="text-xs font-bold text-indigo-600 hover:text-indigo-500">Refresh</button>
          </div>

          {loading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : !website ? (
            <p className="mt-4 text-sm text-slate-500">No website data available.</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {website.pages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setSelectedPageId(page.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider ${selectedPage?.id === page.id ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700"}`}
                  >
                    {page.title}
                  </button>
                ))}
              </div>

              {selectedPage && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black text-slate-900">{selectedPage.title}</p>
                    <p className="text-xs text-slate-600">/{selectedPage.slug}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-600">Status: {selectedPage.isPublished ? "Published" : "Draft"}</p>
                    <button type="button" onClick={() => void togglePublish()} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500">
                      {selectedPage.isPublished ? "Unpublish" : "Publish"}
                    </button>
                  </div>

                  <form onSubmit={addSection} className="rounded-lg border border-slate-200 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">Add Section</p>
                    <div className="mt-3 grid gap-3">
                      <select value={sectionType} onChange={(event) => setSectionType(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                        <option value="hero">Hero</option>
                        <option value="content">Content</option>
                        <option value="grid">Grid</option>
                        <option value="form">Form</option>
                      </select>
                      <input value={sectionOrder} onChange={(event) => setSectionOrder(event.target.value)} placeholder="Order" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <textarea value={sectionContent} onChange={(event) => setSectionContent(event.target.value)} rows={4} className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" />
                    </div>
                    <button type="submit" disabled={addingSection} className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-700 disabled:opacity-60">
                      {addingSection ? "Adding..." : "Add Section"}
                    </button>
                  </form>

                  <div className="space-y-2">
                    {selectedPage.sections.length === 0 ? (
                      <p className="rounded-lg border border-slate-200 px-3 py-4 text-sm text-slate-500">No sections yet on this page.</p>
                    ) : (
                      selectedPage.sections
                        .sort((a, b) => a.order - b.order)
                        .map((section) => (
                          <div key={section.id} className="rounded-lg border border-slate-200 px-3 py-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-900">{section.type}</p>
                              <span className="text-xs font-semibold text-slate-500">Order {section.order}</span>
                            </div>
                            <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(section.content ?? {}, null, 2)}</pre>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
