"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { FONT_OPTIONS } from "@/lib/platform-options";
import { downloadRows, ExportFormat } from "@/lib/export-utils";

type BlockSettings = Record<string, any>;

type WebsiteBlock = {
  id: string;
  type: string;
  settings: BlockSettings;
};

type Revision = {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  content: { blocks: WebsiteBlock[] };
  seo?: Record<string, any> | null;
  changeSummary?: string | null;
  createdBy?: string | null;
  createdAt: string;
};

type WebsitePage = {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  draftRevision: Revision | null;
  publishedRevision: Revision | null;
  revisions: Revision[];
  effectiveContent: { blocks: WebsiteBlock[] };
  effectiveSeo: Record<string, any>;
};

type WebsiteAsset = {
  id: string;
  name: string;
  url: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  altText?: string | null;
  createdAt: string;
};

type WebsiteForm = {
  id: string;
  key: string;
  name: string;
  status: string;
  schema: Record<string, unknown>;
  submissionsCount?: number;
  createdAt: string;
};

type WebsiteFormSubmission = {
  id: string;
  formId: string;
  status: string;
  spamScore: number;
  createdAt: string;
  form?: {
    id: string;
    key: string;
    name: string;
  };
  payloadPreview?: Record<string, string>;
};

type WebsiteDomain = {
  id: string;
  hostname: string;
  status: string;
  sslStatus: string;
  isPrimary: boolean;
  redirectToCanonical?: boolean;
  canonicalUrl?: string | null;
  lastCheckedAt?: string | null;
  createdAt: string;
  verifiedAt?: string | null;
};

type DomainHealth = {
  total: number;
  verified: number;
  pending: number;
  failed: number;
  sslActive: number;
  sslPending: number;
  staleChecks: number;
  staleDomains: Array<{
    id: string;
    hostname: string;
    lastCheckedAt?: string | null;
    status: string;
  }>;
};

type WebsiteSnapshot = {
  id: string;
  tenantId: string;
  themeConfig: {
    primaryColor?: string;
    accentColor?: string;
    font?: string;
    spacingScale?: string;
    radiusScale?: string;
    elevationScale?: string;
    logoUrl?: string;
  };
  pages: WebsitePage[];
  assets: WebsiteAsset[];
  forms: WebsiteForm[];
  domains: WebsiteDomain[];
};

type TemplateCard = {
  id: string;
  key: string;
  name: string;
  family: string;
  description?: string | null;
  previewImageUrl?: string | null;
  status: string;
  schema?: {
    pages?: Array<{
      slug?: string;
      title?: string;
      blocks?: Array<{
        type?: string;
        settings?: Record<string, unknown>;
      }>;
    }>;
  };
};

type AnalyticsPayload = {
  range: string;
  timeline?: Array<{
    date: string;
    pageViews: number;
    ctaClicks: number;
    conversions: number;
    submissions: number;
  }>;
  totals: {
    events: number;
    pageViews: number;
    ctaClicks: number;
    conversions: number;
    formSubmissions: number;
  };
  topPages: Array<{
    pagePath: string;
    pageViews: number;
    ctaClicks: number;
    conversions: number;
  }>;
  topSources: Array<{ source: string; count: number }>;
};

type GlobalSeoSettings = {
  siteName: string;
  titleSuffix: string;
  metaDescription: string;
  canonicalBaseUrl: string;
  ogImageUrl: string;
  organizationName: string;
  organizationUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

type BuilderTab = "builder" | "templates" | "assets" | "forms" | "analytics" | "domains";
type DevicePreview = "desktop" | "tablet" | "mobile";

const BLOCK_LIBRARY: Array<{ type: string; label: string; defaultSettings: BlockSettings }> = [
  {
    type: "hero",
    label: "Hero",
    defaultSettings: {
      eyebrow: "Welcome",
      title: "Grow your church community",
      subtitle: "A modern and welcoming church experience.",
      primaryCtaLabel: "Plan Your Visit",
      primaryCtaHref: "/new-here",
      secondaryCtaLabel: "Watch Live",
      secondaryCtaHref: "/sermons",
    },
  },
  {
    type: "cta_band",
    label: "CTA Band",
    defaultSettings: {
      heading: "Take your next step",
      body: "Let us help you find your place.",
      ctaLabel: "Get Started",
      ctaHref: "/contact",
    },
  },
  {
    type: "feature_grid",
    label: "Feature Grid",
    defaultSettings: {
      heading: "What to expect",
      items: [
        { title: "Worship", description: "Spirit-led and scripture-centered." },
        { title: "Community", description: "Find belonging in groups." },
        { title: "Mission", description: "Serve the city with purpose." },
      ],
    },
  },
  {
    type: "dynamic_list",
    label: "Dynamic List",
    defaultSettings: {
      source: "events",
      heading: "Upcoming Events",
      count: 6,
      fallback: {
        heading: "Upcoming Events",
        body: "No scheduled events right now.",
      },
    },
  },
  {
    type: "form",
    label: "Form",
    defaultSettings: {
      formKey: "contact-us",
      title: "Contact Us",
      description: "Tell us how we can help.",
      submitLabel: "Submit",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "message", label: "Message", type: "textarea", required: true },
      ],
    },
  },
  {
    type: "custom_fragment",
    label: "Custom HTML Fragment",
    defaultSettings: {
      html: "<div class='custom-fragment'><h3>Custom Embed</h3><p>Paste safe HTML fragment.</p></div>",
      warnings: [],
    },
  },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function normalizeFont(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return FONT_OPTIONS.some((option) => option.value === normalized) ? normalized : "inter";
}

function toPrettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJson<T>(value: string, fallback: T) {
  try {
    const parsed = JSON.parse(value) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function getTemplatePages(template: TemplateCard) {
  const pages = Array.isArray(template.schema?.pages) ? template.schema?.pages : [];
  return pages
    .filter((page) => page && typeof page === "object")
    .map((page) => ({
      slug: typeof page.slug === "string" ? page.slug : "",
      title: typeof page.title === "string" ? page.title : "Page",
      blockCount: Array.isArray(page.blocks) ? page.blocks.length : 0,
    }));
}

function getTemplateHero(template: TemplateCard) {
  const pages = getTemplatePages(template);
  const home = pages.find((page) => page.slug === "home") ?? pages[0];
  const full = Array.isArray(template.schema?.pages) ? template.schema.pages : [];
  const homePage = full.find((page) => (typeof page?.slug === "string" ? page.slug : "") === (home?.slug ?? ""));
  const blocks = Array.isArray(homePage?.blocks) ? homePage.blocks : [];
  const hero = blocks.find((block) => block && typeof block === "object" && block.type === "hero");
  const settings = hero?.settings && typeof hero.settings === "object" ? hero.settings : {};
  return typeof settings.title === "string" && settings.title.trim() ? settings.title.trim() : template.name;
}

function getTemplateFamilyGradient(family: string) {
  const normalized = family.trim().toLowerCase();
  if (normalized.includes("corporate")) {
    return "linear-gradient(120deg, #0b5fff 0%, #0f172a 52%, #06b6d4 100%)";
  }
  if (normalized.includes("community")) {
    return "linear-gradient(120deg, #7c3aed 0%, #1f2937 45%, #f43f5e 100%)";
  }
  return "linear-gradient(120deg, #312e81 0%, #0f172a 48%, #16a34a 100%)";
}

export default function WebsiteBuilderPage() {
  const [tab, setTab] = useState<BuilderTab>("builder");
  const [devicePreview, setDevicePreview] = useState<DevicePreview>("desktop");

  const [snapshot, setSnapshot] = useState<WebsiteSnapshot | null>(null);
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState("30d");
  const [domainHealth, setDomainHealth] = useState<DomainHealth | null>(null);
  const [domainRoutingDraft, setDomainRoutingDraft] = useState<Record<string, { redirectToCanonical: boolean; canonicalUrl: string }>>({});
  const [globalSeo, setGlobalSeo] = useState<GlobalSeoSettings>({
    siteName: "Noxera Church",
    titleSuffix: " | Noxera Plus",
    metaDescription: "Church operations platform with services, events, giving, and member care.",
    canonicalBaseUrl: "",
    ogImageUrl: "",
    organizationName: "Noxera Church",
    organizationUrl: "",
    robotsIndex: true,
    robotsFollow: true,
  });
  const [submissions, setSubmissions] = useState<WebsiteFormSubmission[]>([]);
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("");
  const [submissionFormFilter, setSubmissionFormFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const [draftBlocks, setDraftBlocks] = useState<WebsiteBlock[]>([]);
  const [draftSeo, setDraftSeo] = useState<Record<string, any>>({});
  const [draftChanged, setDraftChanged] = useState(false);
  const [draftSummary, setDraftSummary] = useState("Draft update");

  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");

  const [themePrimaryColor, setThemePrimaryColor] = useState("#4f46e5");
  const [themeAccentColor, setThemeAccentColor] = useState("#22c55e");
  const [themeFont, setThemeFont] = useState("inter");

  const [assetName, setAssetName] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetAlt, setAssetAlt] = useState("");

  const [formKey, setFormKey] = useState("contact-us");
  const [formName, setFormName] = useState("Contact Us");
  const [formSchema, setFormSchema] = useState(
    JSON.stringify(
      {
        fields: [
          { key: "name", label: "Name", type: "text", required: true },
          { key: "email", label: "Email", type: "email", required: true },
          { key: "message", label: "Message", type: "textarea", required: true },
        ],
      },
      null,
      2,
    ),
  );

  const [domainHost, setDomainHost] = useState("");

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [websiteResult, templateResult, analyticsResult, seoResult, submissionsResult, domainHealthResult] = await Promise.allSettled([
        apiFetch<WebsiteSnapshot>("/api/admin/website", { cache: "no-store" }),
        apiFetch<TemplateCard[]>("/api/admin/website/templates", { cache: "no-store" }),
        apiFetch<AnalyticsPayload>(`/api/admin/website/analytics?range=${encodeURIComponent(analyticsRange)}`, { cache: "no-store" }),
        apiFetch<GlobalSeoSettings>("/api/admin/website/seo", { cache: "no-store" }),
        apiFetch<WebsiteFormSubmission[]>(
          `/api/admin/website/form-submissions?limit=120${submissionStatusFilter ? `&status=${encodeURIComponent(submissionStatusFilter)}` : ""}${submissionFormFilter ? `&formKey=${encodeURIComponent(submissionFormFilter)}` : ""}`,
          { cache: "no-store" },
        ),
        apiFetch<DomainHealth>("/api/admin/website/domains/health", { cache: "no-store" }),
      ]);

      if (websiteResult.status !== "fulfilled") {
        throw websiteResult.reason;
      }

      const websitePayload = websiteResult.value;
      const partialErrors: string[] = [];

      const templatePayload = templateResult.status === "fulfilled" ? templateResult.value : [];
      if (templateResult.status === "rejected") partialErrors.push("Templates unavailable");

      const analyticsPayload =
        analyticsResult.status === "fulfilled"
          ? analyticsResult.value
          : {
              range: analyticsRange,
              totals: { events: 0, pageViews: 0, ctaClicks: 0, conversions: 0, formSubmissions: 0 },
              topPages: [],
              topSources: [],
              timeline: [],
            };
      if (analyticsResult.status === "rejected") partialErrors.push("Analytics unavailable");

      const seoPayload =
        seoResult.status === "fulfilled"
          ? seoResult.value
          : {
              siteName: "Noxera Church",
              titleSuffix: " | Noxera Plus",
              metaDescription: "Church operations platform with services, events, giving, and member care.",
              canonicalBaseUrl: "",
              ogImageUrl: "",
              organizationName: "Noxera Church",
              organizationUrl: "",
              robotsIndex: true,
              robotsFollow: true,
            };
      if (seoResult.status === "rejected") partialErrors.push("SEO settings unavailable");

      const submissionsPayload = submissionsResult.status === "fulfilled" ? submissionsResult.value : [];
      if (submissionsResult.status === "rejected") partialErrors.push("Form submissions unavailable");

      const domainHealthPayload =
        domainHealthResult.status === "fulfilled"
          ? domainHealthResult.value
          : { total: 0, verified: 0, pending: 0, failed: 0, sslActive: 0, sslPending: 0, staleChecks: 0, staleDomains: [] };
      if (domainHealthResult.status === "rejected") partialErrors.push("Domain health unavailable");

      setSnapshot(websitePayload);
      setTemplates(templatePayload);
      setAnalytics(analyticsPayload);
      setGlobalSeo(seoPayload);
      setSubmissions(submissionsPayload);
      setDomainHealth(domainHealthPayload);
      setDomainRoutingDraft(
        Object.fromEntries(
          websitePayload.domains.map((domain) => [
            domain.id,
            {
              redirectToCanonical: Boolean(domain.redirectToCanonical),
              canonicalUrl: domain.canonicalUrl ?? "",
            },
          ]),
        ),
      );

      if (partialErrors.length > 0) {
        setNotice(`Partial load: ${partialErrors.join(" • ")}`);
      } else {
        setNotice("");
      }

      const themeConfig = websitePayload.themeConfig ?? {};
      setThemePrimaryColor(typeof themeConfig.primaryColor === "string" ? themeConfig.primaryColor : "#4f46e5");
      setThemeAccentColor(typeof themeConfig.accentColor === "string" ? themeConfig.accentColor : "#22c55e");
      setThemeFont(normalizeFont(themeConfig.font));

      setSelectedPageId((current) => {
        if (current && websitePayload.pages.some((page) => page.id === current)) {
          return current;
        }
        return websitePayload.pages[0]?.id ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load website builder data."));
      setSnapshot(null);
      setTemplates([]);
      setAnalytics(null);
      setSubmissions([]);
      setDomainHealth(null);
      setDomainRoutingDraft({});
    } finally {
      setLoading(false);
    }
  }, [analyticsRange, submissionFormFilter, submissionStatusFilter]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const selectedPage = useMemo(
    () => snapshot?.pages.find((page) => page.id === selectedPageId) ?? snapshot?.pages[0] ?? null,
    [snapshot?.pages, selectedPageId],
  );

  useEffect(() => {
    if (!selectedPage) {
      setDraftBlocks([]);
      setDraftSeo({});
      setSelectedBlockId(null);
      setDraftChanged(false);
      return;
    }

    setDraftBlocks((selectedPage.effectiveContent?.blocks ?? []).map((block) => ({ ...block, settings: { ...(block.settings || {}) } })));
    setDraftSeo({ ...(selectedPage.effectiveSeo ?? {}) });
    setSelectedBlockId((selectedPage.effectiveContent?.blocks ?? [])[0]?.id ?? null);
    setDraftChanged(false);
  }, [selectedPage]);

  const selectedBlock = useMemo(
    () => draftBlocks.find((block) => block.id === selectedBlockId) ?? null,
    [draftBlocks, selectedBlockId],
  );

  const pageStats = useMemo(() => {
    const pages = snapshot?.pages ?? [];
    return {
      pages: pages.length,
      published: pages.filter((page) => page.isPublished).length,
      draft: pages.filter((page) => !page.isPublished).length,
      blocks: pages.reduce((sum, page) => sum + (page.effectiveContent?.blocks?.length ?? 0), 0),
    };
  }, [snapshot?.pages]);

  const analyticsMax = useMemo(() => {
    const values = (analytics?.timeline ?? []).flatMap((entry) => [entry.pageViews, entry.conversions, entry.submissions]);
    return Math.max(1, ...values);
  }, [analytics?.timeline]);

  const primaryPublicDomain = useMemo(
    () => (snapshot?.domains ?? []).find((domain) => domain.isPrimary)?.hostname ?? snapshot?.domains?.[0]?.hostname ?? "",
    [snapshot?.domains],
  );

  const devicePreviewClass = useMemo(() => {
    if (devicePreview === "mobile") return "mx-auto w-[360px]";
    if (devicePreview === "tablet") return "mx-auto w-[780px]";
    return "w-full";
  }, [devicePreview]);

  const updateNotice = (text: string) => {
    setNotice(text);
    setError("");
  };

  const updateError = (text: string) => {
    setError(text);
    setNotice("");
  };

  const createPage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPageSlug.trim() || !newPageTitle.trim()) {
      updateError("Page slug and title are required.");
      return;
    }

    setBusy(true);
    try {
      const page = await apiFetch<{ id: string }>("/api/admin/website/pages", {
        method: "POST",
        ...withJsonBody({ slug: newPageSlug.trim(), title: newPageTitle.trim() }),
      });
      updateNotice("Page created.");
      setNewPageSlug("");
      setNewPageTitle("");
      await loadSnapshot();
      setSelectedPageId(page.id);
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to create page."));
    } finally {
      setBusy(false);
    }
  };

  const addBlock = (type: string) => {
    const library = BLOCK_LIBRARY.find((item) => item.type === type);
    if (!library) return;

    const next: WebsiteBlock = {
      id: `${type}-${crypto.randomUUID().slice(0, 8)}`,
      type,
      settings: JSON.parse(JSON.stringify(library.defaultSettings)),
    };

    setDraftBlocks((current) => [...current, next]);
    setSelectedBlockId(next.id);
    setDraftChanged(true);
  };

  const deleteBlock = (blockId: string) => {
    setDraftBlocks((current) => current.filter((block) => block.id !== blockId));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
    setDraftChanged(true);
  };

  const shiftBlock = (blockId: string, direction: "up" | "down") => {
    setDraftBlocks((current) => {
      const index = current.findIndex((block) => block.id === blockId);
      if (index < 0) return current;

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      return moveItem(current, index, nextIndex);
    });
    setDraftChanged(true);
  };

  const updateSelectedBlockSettings = (nextSettings: Record<string, unknown>) => {
    if (!selectedBlock) return;

    setDraftBlocks((current) =>
      current.map((block) =>
        block.id === selectedBlock.id
          ? {
              ...block,
              settings: {
                ...block.settings,
                ...nextSettings,
              },
            }
          : block,
      ),
    );
    setDraftChanged(true);
  };

  const updateSelectedBlockSettingsJson = (json: string) => {
    if (!selectedBlock) return;

    const parsed = parseJson<Record<string, unknown>>(json, selectedBlock.settings ?? {});
    setDraftBlocks((current) =>
      current.map((block) =>
        block.id === selectedBlock.id
          ? {
              ...block,
              settings: parsed,
            }
          : block,
      ),
    );
    setDraftChanged(true);
  };

  const saveDraft = async () => {
    if (!selectedPage) return;

    setBusy(true);
    try {
      const payload = await apiFetch<{ warnings?: string[] }>(`/api/admin/website/pages/${selectedPage.id}/draft`, {
        method: "PUT",
        ...withJsonBody({
          title: selectedPage.title,
          content: { blocks: draftBlocks },
          seo: draftSeo,
          changeSummary: draftSummary,
        }),
      });

      if (payload.warnings?.length) {
        updateNotice(`Draft saved with sanitizer notes: ${payload.warnings.join(" ")}`);
      } else {
        updateNotice("Draft saved.");
      }

      setDraftChanged(false);
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to save draft."));
    } finally {
      setBusy(false);
    }
  };

  const publishPage = async () => {
    if (!selectedPage) return;

    setBusy(true);
    try {
      await saveDraft();
      await apiFetch(`/api/admin/website/pages/${selectedPage.id}/publish`, { method: "POST" });
      updateNotice("Page published.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to publish page."));
    } finally {
      setBusy(false);
    }
  };

  const rollbackPage = async (revisionId?: string) => {
    if (!selectedPage) return;

    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/pages/${selectedPage.id}/rollback`, {
        method: "POST",
        ...withJsonBody({ revisionId: revisionId ?? null }),
      });
      updateNotice("Page rolled back.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to rollback page."));
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async () => {
    setBusy(true);
    try {
      if (draftChanged) {
        await saveDraft();
      }
      const payload = await apiFetch<{ token: string }>("/api/admin/website/preview-token", { method: "POST" });
      window.open(`/website-preview/${payload.token}`, "_blank");
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to open preview."));
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = async (templateKey: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/templates/${encodeURIComponent(templateKey)}/apply`, { method: "POST" });
      updateNotice("Template applied successfully.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to apply template."));
    } finally {
      setBusy(false);
    }
  };

  const saveTheme = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/admin/website/theme", {
        method: "PUT",
        ...withJsonBody({
          primaryColor: themePrimaryColor,
          accentColor: themeAccentColor,
          font: themeFont,
        }),
      });
      updateNotice("Theme updated.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to update theme."));
    } finally {
      setBusy(false);
    }
  };

  const saveGlobalSeo = async () => {
    setBusy(true);
    try {
      const payload = await apiFetch<GlobalSeoSettings>("/api/admin/website/seo", {
        method: "PUT",
        ...withJsonBody(globalSeo),
      });
      setGlobalSeo(payload);
      updateNotice("Global SEO settings updated.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to update global SEO settings."));
    } finally {
      setBusy(false);
    }
  };

  const validateFragment = async () => {
    if (!selectedBlock || selectedBlock.type !== "custom_fragment") return;

    setBusy(true);
    try {
      const payload = await apiFetch<{ sanitizedHtml: string; warnings: string[] }>("/api/admin/website/fragments/validate", {
        method: "POST",
        ...withJsonBody({ html: String(selectedBlock.settings.html || "") }),
      });
      updateSelectedBlockSettings({
        html: payload.sanitizedHtml,
        warnings: payload.warnings,
      });
      updateNotice(payload.warnings.length ? `Fragment sanitized: ${payload.warnings.join(" ")}` : "Fragment validated.");
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to validate fragment."));
    } finally {
      setBusy(false);
    }
  };

  const createAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assetName.trim() || !assetUrl.trim()) {
      updateError("Asset name and URL are required.");
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/api/admin/website/assets", {
        method: "POST",
        ...withJsonBody({
          name: assetName.trim(),
          url: assetUrl.trim(),
          altText: assetAlt.trim() || undefined,
        }),
      });
      updateNotice("Asset saved.");
      setAssetName("");
      setAssetUrl("");
      setAssetAlt("");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to save asset."));
    } finally {
      setBusy(false);
    }
  };

  const deleteAsset = async (assetId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/assets/${assetId}`, { method: "DELETE" });
      updateNotice("Asset removed.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to delete asset."));
    } finally {
      setBusy(false);
    }
  };

  const createForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formKey.trim() || !formName.trim()) {
      updateError("Form key and name are required.");
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/api/admin/website/forms", {
        method: "POST",
        ...withJsonBody({
          key: formKey.trim(),
          name: formName.trim(),
          schema: parseJson(formSchema, { fields: [] }),
        }),
      });
      updateNotice("Form saved.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to save form."));
    } finally {
      setBusy(false);
    }
  };

  const updateSubmissionStatus = async (submissionId: string, status: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/form-submissions/${submissionId}/status`, {
        method: "PUT",
        ...withJsonBody({ status }),
      });
      updateNotice("Submission status updated.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to update submission status."));
    } finally {
      setBusy(false);
    }
  };

  const verifyDomain = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!domainHost.trim()) {
      updateError("Domain hostname is required.");
      return;
    }

    setBusy(true);
    try {
      const payload = await apiFetch<{ instructions?: { host: string; value: string } }>("/api/admin/website/domains/verify", {
        method: "POST",
        ...withJsonBody({ hostname: domainHost.trim() }),
      });
      setDomainHost("");
      updateNotice(payload.instructions ? `Domain verification record created. Add TXT ${payload.instructions.host} = ${payload.instructions.value}` : "Domain verification requested.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to verify domain."));
    } finally {
      setBusy(false);
    }
  };

  const checkDomain = async (domainId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/domains/${domainId}/check`, { method: "POST" });
      updateNotice("Domain status refreshed.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to refresh domain."));
    } finally {
      setBusy(false);
    }
  };

  const retryDomain = async (domainId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/domains/${domainId}/retry`, { method: "POST" });
      updateNotice("Domain verification retry triggered.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to retry domain verification."));
    } finally {
      setBusy(false);
    }
  };

  const setPrimaryDomain = async (domainId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/domains/${domainId}/set-primary`, { method: "POST" });
      updateNotice("Primary domain updated.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to set primary domain."));
    } finally {
      setBusy(false);
    }
  };

  const saveDomainRouting = async (domainId: string) => {
    const draft = domainRoutingDraft[domainId];
    if (!draft) return;

    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/domains/${domainId}/routing`, {
        method: "PUT",
        ...withJsonBody({
          redirectToCanonical: draft.redirectToCanonical,
          canonicalUrl: draft.canonicalUrl.trim() || null,
        }),
      });
      updateNotice("Domain routing policy saved.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to save domain routing policy."));
    } finally {
      setBusy(false);
    }
  };

  const removeDomain = async (domainId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/website/domains/${domainId}`, { method: "DELETE" });
      updateNotice("Domain removed.");
      await loadSnapshot();
    } catch (err) {
      updateError(getErrorMessage(err, "Unable to remove domain."));
    } finally {
      setBusy(false);
    }
  };

  const exportAnalytics = async (format: ExportFormat) => {
    if (!analytics) return;
    await downloadRows(
      format,
      `website-analytics-${analytics.range}`,
      analytics.topPages,
      [
        { label: "Page", value: (row) => row.pagePath },
        { label: "Page Views", value: (row) => row.pageViews },
        { label: "CTA Clicks", value: (row) => row.ctaClicks },
        { label: "Conversions", value: (row) => row.conversions },
      ],
      "Website analytics",
    );
  };

  const exportSubmissions = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "website-form-submissions",
      submissions,
      [
        { label: "Form", value: (row) => row.form?.name || row.formId },
        { label: "Status", value: (row) => row.status },
        { label: "Spam Score", value: (row) => row.spamScore },
        { label: "Created", value: (row) => new Date(row.createdAt).toISOString() },
      ],
      "Website form submissions",
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className="rounded-3xl border border-slate-200 p-6 text-white shadow-lg"
        style={{
          backgroundImage:
            "linear-gradient(108deg, rgba(var(--brand-primary-rgb),0.4) 0%, rgba(15,23,42,0.95) 38%, rgba(var(--brand-accent-rgb),0.34) 100%)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-200">Website Builder Studio</p>
            <h2 className="mt-2 text-3xl font-black">High-end templates, visual blocks, publish governance, and growth analytics.</h2>
            <p className="mt-2 text-sm text-slate-200">
              Draft safely, preview responsively, publish with confidence, and scale from subdomain to custom domains.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Pages</p>
              <p className="mt-1 text-2xl font-black text-white">{pageStats.pages}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Published</p>
              <p className="mt-1 text-2xl font-black text-emerald-200">{pageStats.published}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Draft</p>
              <p className="mt-1 text-2xl font-black text-amber-200">{pageStats.draft}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Blocks</p>
              <p className="mt-1 text-2xl font-black text-white">{pageStats.blocks}</p>
            </div>
          </div>
        </div>
      </section>

      {(error || notice) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || notice}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {([
            ["builder", "Builder"],
            ["templates", "Templates"],
            ["assets", "Assets"],
            ["forms", "Forms"],
            ["analytics", "Analytics"],
            ["domains", "Domains"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
                tab === value ? "nx-brand-btn text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {tab === "builder" && (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Pages</h3>
              <div className="mt-3 space-y-2">
                {snapshot?.pages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setSelectedPageId(page.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      selectedPage?.id === page.id
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-black text-slate-900">{page.title}</p>
                    <p className="text-xs font-semibold text-slate-500">/{page.slug}</p>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={createPage} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">New page</p>
              <input
                value={newPageTitle}
                onChange={(event) => setNewPageTitle(event.target.value)}
                placeholder="Page title"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={newPageSlug}
                onChange={(event) => setNewPageSlug(event.target.value)}
                placeholder="page-slug"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">
                Add page
              </button>
            </form>

            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Block library</h3>
              <div className="mt-3 grid gap-2">
                {BLOCK_LIBRARY.map((block) => (
                  <button
                    key={block.type}
                    type="button"
                    onClick={() => addBlock(block.type)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    + {block.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Publishing workflow</p>
                <p className="text-sm font-semibold text-slate-700">
                  {selectedPage?.title || "No page selected"} • {draftChanged ? "Unsaved changes" : "Saved"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(["desktop", "tablet", "mobile"] as const).map((device) => (
                  <button
                    key={device}
                    type="button"
                    onClick={() => setDevicePreview(device)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider ${
                      devicePreview === device ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
                    }`}
                  >
                    {device}
                  </button>
                ))}

                <button type="button" onClick={() => void saveDraft()} disabled={busy || !selectedPage} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-60">
                  Save Draft
                </button>
                <button type="button" onClick={() => void openPreview()} disabled={busy || !selectedPage} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-60">
                  Preview
                </button>
                <button type="button" onClick={() => void publishPage()} disabled={busy || !selectedPage} className="rounded-lg nx-brand-btn px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">
                  Publish
                </button>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_auto]">
              <input
                value={draftSeo.title ?? ""}
                onChange={(event) => {
                  setDraftSeo((current) => ({ ...current, title: event.target.value }));
                  setDraftChanged(true);
                }}
                placeholder="SEO title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={draftSeo.canonicalUrl ?? ""}
                onChange={(event) => {
                  setDraftSeo((current) => ({ ...current, canonicalUrl: event.target.value }));
                  setDraftChanged(true);
                }}
                placeholder="Canonical URL"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                value={draftSeo.description ?? ""}
                onChange={(event) => {
                  setDraftSeo((current) => ({ ...current, description: event.target.value }));
                  setDraftChanged(true);
                }}
                rows={2}
                placeholder="Meta description"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
              />
            </div>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Global SEO & Indexing</p>
                  <p className="text-sm font-semibold text-slate-700">Controls sitemap, robots policy, and default metadata for all published pages.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void saveGlobalSeo()}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-60"
                >
                  Save Global SEO
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  value={globalSeo.siteName}
                  onChange={(event) => setGlobalSeo((current) => ({ ...current, siteName: event.target.value }))}
                  placeholder="Site name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={globalSeo.titleSuffix}
                  onChange={(event) => setGlobalSeo((current) => ({ ...current, titleSuffix: event.target.value }))}
                  placeholder="Title suffix"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={globalSeo.canonicalBaseUrl}
                  onChange={(event) => setGlobalSeo((current) => ({ ...current, canonicalBaseUrl: event.target.value }))}
                  placeholder="Canonical base URL (https://churchdomain.org)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                />
                <textarea
                  value={globalSeo.metaDescription}
                  onChange={(event) => setGlobalSeo((current) => ({ ...current, metaDescription: event.target.value }))}
                  rows={2}
                  placeholder="Default meta description"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                />
                <input
                  value={globalSeo.ogImageUrl}
                  onChange={(event) => setGlobalSeo((current) => ({ ...current, ogImageUrl: event.target.value }))}
                  placeholder="Default OG image URL"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                />
                <input
                  value={globalSeo.organizationName}
                  onChange={(event) => setGlobalSeo((current) => ({ ...current, organizationName: event.target.value }))}
                  placeholder="Organization name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={globalSeo.organizationUrl}
                  onChange={(event) => setGlobalSeo((current) => ({ ...current, organizationUrl: event.target.value }))}
                  placeholder="Organization URL"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={globalSeo.robotsIndex}
                    onChange={(event) => setGlobalSeo((current) => ({ ...current, robotsIndex: event.target.checked }))}
                  />
                  Allow indexing
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={globalSeo.robotsFollow}
                    onChange={(event) => setGlobalSeo((current) => ({ ...current, robotsFollow: event.target.checked }))}
                  />
                  Allow link following
                </label>
              </div>
            </section>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={draftSummary}
                  onChange={(event) => setDraftSummary(event.target.value)}
                  placeholder="Change summary"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => void rollbackPage()} disabled={busy || !selectedPage} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-60">
                  Rollback
                </button>
              </div>

              <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 ${devicePreviewClass}`}>
                <div className="max-h-[70vh] overflow-y-auto p-4">
                  {draftBlocks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-600 p-8 text-center text-sm font-semibold text-slate-400">
                      Add blocks from the left panel to build this page.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {draftBlocks.map((block, index) => (
                        <button
                          key={block.id}
                          type="button"
                          onClick={() => setSelectedBlockId(block.id)}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            selectedBlockId === block.id
                              ? "border-indigo-400 bg-indigo-500/15"
                              : "border-slate-700 bg-slate-900/80 hover:border-slate-500"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black uppercase tracking-wider text-indigo-200">{index + 1}. {block.type.replace(/_/g, " ")}</p>
                            <div className="flex items-center gap-1">
                              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{block.id}</span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-slate-200 line-clamp-2">{block.settings.title || block.settings.heading || block.settings.subtitle || "Block settings"}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>

          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Theme</p>
              <div className="mt-2 grid gap-2">
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Primary
                  <input type="color" value={themePrimaryColor} onChange={(event) => setThemePrimaryColor(event.target.value)} className="h-9 w-12 rounded border border-slate-300 bg-white" />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Accent
                  <input type="color" value={themeAccentColor} onChange={(event) => setThemeAccentColor(event.target.value)} className="h-9 w-12 rounded border border-slate-300 bg-white" />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Font
                  <select value={themeFont} onChange={(event) => setThemeFont(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {FONT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => void saveTheme()} disabled={busy} className="rounded-lg nx-brand-btn px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">
                  Save Theme
                </button>
              </div>
            </section>

            {selectedBlock ? (
              <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Inspector</p>
                    <p className="text-sm font-black text-slate-900">{selectedBlock.type.replace(/_/g, " ")}</p>
                  </div>
                  <button type="button" onClick={() => deleteBlock(selectedBlock.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => shiftBlock(selectedBlock.id, "up")} className="rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Move Up
                  </button>
                  <button type="button" onClick={() => shiftBlock(selectedBlock.id, "down")} className="rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Move Down
                  </button>
                </div>

                {(selectedBlock.type === "hero" || selectedBlock.type === "cta_band") && (
                  <div className="grid gap-2">
                    <input
                      value={selectedBlock.settings.title ?? selectedBlock.settings.heading ?? ""}
                      onChange={(event) =>
                        updateSelectedBlockSettings(
                          selectedBlock.type === "hero"
                            ? { title: event.target.value }
                            : { heading: event.target.value },
                        )
                      }
                      placeholder="Headline"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={selectedBlock.settings.subtitle ?? selectedBlock.settings.body ?? ""}
                      onChange={(event) =>
                        updateSelectedBlockSettings(
                          selectedBlock.type === "hero"
                            ? { subtitle: event.target.value }
                            : { body: event.target.value },
                        )
                      }
                      rows={3}
                      placeholder="Description"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <textarea
                  value={toPrettyJson(selectedBlock.settings)}
                  onChange={(event) => updateSelectedBlockSettingsJson(event.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />

                {selectedBlock.type === "custom_fragment" && (
                  <button type="button" onClick={() => void validateFragment()} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">
                    Validate & Sanitize Fragment
                  </button>
                )}
              </section>
            ) : (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                Select a block to edit settings and reorder.
              </section>
            )}

            {selectedPage?.revisions?.length ? (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">History</p>
                <div className="mt-2 space-y-2">
                  {selectedPage.revisions.slice(0, 6).map((revision) => (
                    <button
                      key={revision.id}
                      type="button"
                      onClick={() => void rollbackPage(revision.id)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      <p className="font-black uppercase tracking-wider text-slate-500">v{revision.version} • {revision.status}</p>
                      <p className="mt-1 font-semibold">{revision.changeSummary || "Revision"}</p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      )}

      {tab === "templates" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-slate-900">Template Gallery</h3>
          <p className="mt-1 text-sm text-slate-500">6 premium templates across Corporate Ministry, Community Growth, and Classic Church Modern families.</p>
          {(templates ?? []).length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">No templates loaded yet.</p>
              <p className="mt-1 text-xs text-slate-500">Refresh after ensuring API and DB migrations are running.</p>
              <button
                type="button"
                onClick={() => void loadSnapshot()}
                className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Refresh Templates
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const pages = getTemplatePages(template);
                const heroTitle = getTemplateHero(template);
                return (
                  <article key={template.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div
                      className="rounded-xl border border-white/30 p-4 text-white"
                      style={{ backgroundImage: getTemplateFamilyGradient(template.family) }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">{template.family}</p>
                      <p className="mt-2 text-lg font-black leading-tight">{heroTitle}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {pages.slice(0, 4).map((page) => (
                          <span key={`${template.key}-${page.slug}`} className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-100">
                            {page.slug || page.title}
                          </span>
                        ))}
                        {pages.length > 4 ? (
                          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-100">
                            +{pages.length - 4}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{template.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{template.description || "Premium template."}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{pages.length} pages in starter kit</p>

                    <button
                      type="button"
                      onClick={async () => {
                        await applyTemplate(template.key);
                        setTab("builder");
                      }}
                      disabled={busy}
                      className="mt-4 rounded-lg nx-brand-btn px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60"
                    >
                      Apply Template
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "assets" && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-slate-900">Media Library</h3>
          <form onSubmit={createAsset} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
            <input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="Asset name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} placeholder="https://..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            <input value={assetAlt} onChange={(event) => setAssetAlt(event.target.value)} placeholder="Alt text" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy} className="rounded-lg nx-brand-btn px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60 md:col-span-4">
              Save Asset
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(snapshot?.assets ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">No assets yet.</td>
                  </tr>
                ) : (
                  (snapshot?.assets ?? []).map((asset) => (
                    <tr key={asset.id}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{asset.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{asset.url}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{new Date(asset.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => void deleteAsset(asset.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Top Source</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(analytics?.topSources ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-500">
                      No source data recorded yet.
                    </td>
                  </tr>
                ) : (
                  (analytics?.topSources ?? []).map((source) => (
                    <tr key={source.source}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{source.source}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{source.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "forms" && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-black text-slate-900">Website Forms & Submission Queue</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void exportSubmissions("csv")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => void exportSubmissions("excel")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Export Excel
              </button>
            </div>
          </div>
          <form onSubmit={createForm} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input value={formKey} onChange={(event) => setFormKey(event.target.value)} placeholder="form-key" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Form Name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <textarea value={formSchema} onChange={(event) => setFormSchema(event.target.value)} rows={8} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" />
            <button type="submit" disabled={busy} className="rounded-lg nx-brand-btn px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">
              Save Form
            </button>
          </form>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(snapshot?.forms ?? []).map((form) => (
              <article key={form.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{form.key}</p>
                <h4 className="text-lg font-black text-slate-900">{form.name}</h4>
                <p className="mt-1 text-xs text-slate-600">Status: {form.status}</p>
                <p className="text-xs text-slate-600">Submissions: {form.submissionsCount ?? 0}</p>
              </article>
            ))}
          </div>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900">Submission Moderation</p>
              <button
                type="button"
                onClick={() => void loadSnapshot()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Refresh Queue
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <select
                value={submissionStatusFilter}
                onChange={(event) => setSubmissionStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="received">Received</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
                <option value="quarantined">Quarantined</option>
                <option value="spam">Spam</option>
              </select>
              <select
                value={submissionFormFilter}
                onChange={(event) => setSubmissionFormFilter(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All forms</option>
                {(snapshot?.forms ?? []).map((form) => (
                  <option key={form.id} value={form.key}>
                    {form.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setSubmissionStatusFilter("");
                  setSubmissionFormFilter("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Clear Filters
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Form</th>
                    <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Preview</th>
                    <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Spam</th>
                    <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Submitted</th>
                    <th className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wider text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        No submissions match current filters.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((submission) => (
                      <tr key={submission.id}>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-800">{submission.form?.name || submission.formId}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {Object.entries(submission.payloadPreview ?? {})
                            .slice(0, 2)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" • ") || "No preview"}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-700">{submission.status}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-700">{submission.spamScore}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{new Date(submission.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <select
                            value={submission.status}
                            onChange={(event) => void updateSubmissionStatus(submission.id, event.target.value)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold"
                            disabled={busy}
                          >
                            <option value="received">received</option>
                            <option value="reviewed">reviewed</option>
                            <option value="resolved">resolved</option>
                            <option value="quarantined">quarantined</option>
                            <option value="spam">spam</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {tab === "analytics" && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-black text-slate-900">Website Analytics</h3>
            <div className="flex items-center gap-2">
              <select value={analyticsRange} onChange={(event) => setAnalyticsRange(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="7d">Last 7 days</option>
                <option value="14d">Last 14 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button type="button" onClick={() => void loadSnapshot()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Page Views</p><p className="mt-1 text-2xl font-black text-slate-900">{analytics?.totals.pageViews ?? 0}</p></article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">CTA Clicks</p><p className="mt-1 text-2xl font-black text-slate-900">{analytics?.totals.ctaClicks ?? 0}</p></article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Conversions</p><p className="mt-1 text-2xl font-black text-emerald-700">{analytics?.totals.conversions ?? 0}</p></article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Form Submissions</p><p className="mt-1 text-2xl font-black text-slate-900">{analytics?.totals.formSubmissions ?? 0}</p></article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Events</p><p className="mt-1 text-2xl font-black text-slate-900">{analytics?.totals.events ?? 0}</p></article>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Trend (Views vs Conversions)</p>
            {(analytics?.timeline ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No trend data yet for this range.</p>
            ) : (
              <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto">
                {(analytics?.timeline ?? []).map((point) => (
                  <div key={point.date} className="flex min-w-[18px] flex-col items-center gap-1">
                    <div className="w-2 rounded-t bg-indigo-500" style={{ height: `${Math.max(4, (point.pageViews / analyticsMax) * 120)}px` }} title={`${point.date} views: ${point.pageViews}`} />
                    <div className="w-2 rounded-t bg-emerald-500" style={{ height: `${Math.max(4, (point.conversions / analyticsMax) * 120)}px` }} title={`${point.date} conversions: ${point.conversions}`} />
                    <span className="text-[9px] font-semibold text-slate-500">{point.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void exportAnalytics("csv")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700">Download CSV</button>
            <button type="button" onClick={() => void exportAnalytics("excel")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700">Download Excel</button>
            <button type="button" onClick={() => void exportAnalytics("pdf")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700">Download PDF</button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Page</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Views</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">CTA</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Conversions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(analytics?.topPages ?? []).map((row) => (
                  <tr key={row.pagePath}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.pagePath}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.pageViews}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.ctaClicks}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "domains" && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-slate-900">Domains & SSL</h3>

          <div className="grid gap-3 md:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{domainHealth?.total ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Verified</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">{domainHealth?.verified ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pending</p>
              <p className="mt-1 text-2xl font-black text-amber-700">{domainHealth?.pending ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Stale Checks</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{domainHealth?.staleChecks ?? 0}</p>
            </article>
          </div>

          <form onSubmit={verifyDomain} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto]">
            <input value={domainHost} onChange={(event) => setDomainHost(event.target.value)} placeholder="churchdomain.org" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy} className="rounded-lg nx-brand-btn px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">
              Verify Domain
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">SEO Endpoints</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={primaryPublicDomain ? `/api/public/website/${encodeURIComponent(primaryPublicDomain)}/robots` : "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Open robots.txt
              </a>
              <a
                href={primaryPublicDomain ? `/api/public/website/${encodeURIComponent(primaryPublicDomain)}/sitemap` : "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Open sitemap.xml
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Hostname</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">SSL</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Routing</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(snapshot?.domains ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No domains configured yet.</td>
                  </tr>
                ) : (
                  (snapshot?.domains ?? []).map((domain) => (
                    <tr key={domain.id}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {domain.hostname}
                        {domain.isPrimary ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">Primary</span> : null}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{domain.status}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{domain.sslStatus}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                            <input
                              type="checkbox"
                              checked={domainRoutingDraft[domain.id]?.redirectToCanonical ?? false}
                              onChange={(event) =>
                                setDomainRoutingDraft((current) => ({
                                  ...current,
                                  [domain.id]: {
                                    redirectToCanonical: event.target.checked,
                                    canonicalUrl: current[domain.id]?.canonicalUrl ?? domain.canonicalUrl ?? "",
                                  },
                                }))
                              }
                            />
                            Redirect to canonical
                          </label>
                          <input
                            value={domainRoutingDraft[domain.id]?.canonicalUrl ?? domain.canonicalUrl ?? ""}
                            onChange={(event) =>
                              setDomainRoutingDraft((current) => ({
                                ...current,
                                [domain.id]: {
                                  redirectToCanonical: current[domain.id]?.redirectToCanonical ?? Boolean(domain.redirectToCanonical),
                                  canonicalUrl: event.target.value,
                                },
                              }))
                            }
                            placeholder="https://churchdomain.org"
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => void saveDomainRouting(domain.id)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700"
                          >
                            Save Routing
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => void checkDomain(domain.id)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">Check</button>
                          <button type="button" onClick={() => void retryDomain(domain.id)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">Retry</button>
                          <button type="button" onClick={() => void setPrimaryDomain(domain.id)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">Set Primary</button>
                          <button type="button" onClick={() => void removeDomain(domain.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
