import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Section, WebsiteDomain } from '@noxera-plus/shared';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { resolveTxt } from 'dns/promises';
import { PrismaService } from '../prisma/prisma.service';
import { WEBSITE_TEMPLATE_LIBRARY, type WebsiteBlock, type WebsiteTemplateDefinition } from './website-templates';
import { sanitizeHtmlFragment, WEBSITE_EMBED_HOST_ALLOWLIST } from './website-sanitizer';

type SaveDraftPayload = {
  title?: string;
  content: {
    blocks: WebsiteBlock[];
  };
  seo?: Record<string, unknown>;
  changeSummary?: string;
  actorEmail?: string | null;
};

type CreateAssetPayload = {
  name: string;
  url: string;
  storageKey?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  altText?: string;
  actorEmail?: string | null;
};

type CreateFormPayload = {
  key: string;
  name: string;
  schema: Record<string, unknown>;
  notificationConfig?: Record<string, unknown>;
  actorEmail?: string | null;
};

type SubmitFormPayload = {
  fields: Record<string, unknown>;
  sourcePath?: string;
};

type TrackAnalyticsPayload = {
  pagePath: string;
  eventType: 'page_view' | 'cta_click' | 'form_submit';
  source?: string;
  payload?: Record<string, unknown>;
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

const DEFAULT_THEME: Record<string, unknown> = {
  primaryColor: '#4f46e5',
  accentColor: '#22c55e',
  font: 'inter',
  spacingScale: 'balanced',
  radiusScale: 'md',
  elevationScale: 'soft',
};

function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function defaultSeoForPage(title: string, slug: string) {
  return {
    title,
    description: `Learn more about ${title}.`,
    canonicalUrl: `/${slug}`,
    index: true,
    follow: true,
    ogTitle: title,
    ogDescription: `Learn more about ${title}.`,
    ogImage: null,
  };
}

function sanitizeSeo(input: unknown, fallbackTitle: string, fallbackSlug: string) {
  const candidate = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const defaultSeo = defaultSeoForPage(fallbackTitle, fallbackSlug);

  return {
    title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : defaultSeo.title,
    description:
      typeof candidate.description === 'string' && candidate.description.trim()
        ? candidate.description.trim()
        : defaultSeo.description,
    canonicalUrl:
      typeof candidate.canonicalUrl === 'string' && candidate.canonicalUrl.trim()
        ? candidate.canonicalUrl.trim()
        : defaultSeo.canonicalUrl,
    index: candidate.index !== false,
    follow: candidate.follow !== false,
    ogTitle:
      typeof candidate.ogTitle === 'string' && candidate.ogTitle.trim()
        ? candidate.ogTitle.trim()
        : defaultSeo.ogTitle,
    ogDescription:
      typeof candidate.ogDescription === 'string' && candidate.ogDescription.trim()
        ? candidate.ogDescription.trim()
        : defaultSeo.ogDescription,
    ogImage: typeof candidate.ogImage === 'string' && candidate.ogImage.trim() ? candidate.ogImage.trim() : null,
  };
}

function sortByVersionDesc<T extends { version: number }>(items: T[]) {
  return [...items].sort((a, b) => b.version - a.version);
}

function parseRangeToDate(range: string | undefined) {
  if (!range) {
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  const normalized = range.trim().toLowerCase();
  if (normalized === '7d') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (normalized === '14d') return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  if (normalized === '90d') return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0] ?? '';
}

function sha256(value: string | null | undefined) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex');
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(input: Date, days: number) {
  const next = new Date(input);
  next.setDate(next.getDate() + days);
  return next;
}

function defaultGlobalSeo(baseUrl?: string): GlobalSeoSettings {
  return {
    siteName: 'Noxera Church',
    titleSuffix: ' | Noxera Plus',
    metaDescription: 'Church operations platform with services, events, giving, and member care.',
    canonicalBaseUrl: baseUrl ?? '',
    ogImageUrl: '',
    organizationName: 'Noxera Church',
    organizationUrl: baseUrl ?? '',
    robotsIndex: true,
    robotsFollow: true,
  };
}

function normalizeGlobalSeo(input: unknown, fallback: GlobalSeoSettings): GlobalSeoSettings {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    siteName: typeof source.siteName === 'string' && source.siteName.trim() ? source.siteName.trim() : fallback.siteName,
    titleSuffix: typeof source.titleSuffix === 'string' ? source.titleSuffix.trim() : fallback.titleSuffix,
    metaDescription:
      typeof source.metaDescription === 'string' && source.metaDescription.trim()
        ? source.metaDescription.trim()
        : fallback.metaDescription,
    canonicalBaseUrl:
      typeof source.canonicalBaseUrl === 'string' && source.canonicalBaseUrl.trim()
        ? source.canonicalBaseUrl.trim()
        : fallback.canonicalBaseUrl,
    ogImageUrl: typeof source.ogImageUrl === 'string' ? source.ogImageUrl.trim() : fallback.ogImageUrl,
    organizationName:
      typeof source.organizationName === 'string' && source.organizationName.trim()
        ? source.organizationName.trim()
        : fallback.organizationName,
    organizationUrl:
      typeof source.organizationUrl === 'string' && source.organizationUrl.trim()
        ? source.organizationUrl.trim()
        : fallback.organizationUrl,
    robotsIndex: source.robotsIndex !== false,
    robotsFollow: source.robotsFollow !== false,
  };
}

function maybeMaskEmail(value: string) {
  const match = value.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
  if (!match) return value;
  const local = match[1];
  const domain = match[2];
  if (local.length <= 2) return `**@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function maybeMaskPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return value;
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}

function previewSubmissionFields(payload: Prisma.JsonValue) {
  const candidate = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const fields = candidate.fields && typeof candidate.fields === 'object' ? (candidate.fields as Record<string, unknown>) : {};
  const preview: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(fields)) {
    if (typeof rawValue !== 'string') continue;
    const lowerKey = key.toLowerCase();
    const value = rawValue.trim();
    if (!value) continue;
    if (lowerKey.includes('email')) {
      preview[key] = maybeMaskEmail(value);
      continue;
    }
    if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('tel')) {
      preview[key] = maybeMaskPhone(value);
      continue;
    }
    preview[key] = value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }

  return preview;
}

@Injectable()
export class WebsiteService {
  constructor(private prisma: PrismaService) {}

  private async upsertTemplateCatalog() {
    await Promise.all(
      WEBSITE_TEMPLATE_LIBRARY.map((template) =>
        this.prisma.websiteTemplate.upsert({
          where: { key: template.key },
          create: {
            key: template.key,
            name: template.name,
            family: template.family,
            status: template.status,
            description: template.description,
            previewImageUrl: template.previewImageUrl,
            schema: {
              themeConfig: template.themeConfig,
              pages: template.pages,
            } as Prisma.InputJsonValue,
          },
          update: {
            name: template.name,
            family: template.family,
            status: template.status,
            description: template.description,
            previewImageUrl: template.previewImageUrl,
            schema: {
              themeConfig: template.themeConfig,
              pages: template.pages,
            } as Prisma.InputJsonValue,
          },
        }),
      ),
    );
  }

  private sectionToBlock(section: Section): WebsiteBlock {
    return {
      id: section.id,
      type: section.type as WebsiteBlock['type'],
      settings: (section.content as Record<string, unknown> | null) ?? {},
    };
  }

  private normalizeBlocks(input: unknown) {
    const blocksRaw = Array.isArray(input) ? input : [];
    const warnings: string[] = [];

    const blocks = blocksRaw
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => {
        const candidate = item as Record<string, unknown>;
        const blockType = typeof candidate.type === 'string' ? candidate.type : 'content';
        const blockId =
          typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `block-${index + 1}-${randomUUID().slice(0, 8)}`;
        const settings = candidate.settings && typeof candidate.settings === 'object' && !Array.isArray(candidate.settings)
          ? { ...(candidate.settings as Record<string, unknown>) }
          : {};

        if (blockType === 'custom_fragment') {
          const originalHtml = typeof settings.html === 'string' ? settings.html : '';
          const sanitized = sanitizeHtmlFragment(originalHtml);
          settings.htmlOriginal = originalHtml;
          settings.html = sanitized.sanitizedHtml;
          settings.warnings = sanitized.warnings;
          warnings.push(...sanitized.warnings);
        }

        return {
          id: blockId,
          type: blockType as WebsiteBlock['type'],
          settings,
        } satisfies WebsiteBlock;
      });

    return { blocks, warnings };
  }

  private async ensureWebsite(tenantId: string) {
    await this.upsertTemplateCatalog();

    const baseWebsiteInclude = {
      pages: {
        include: {
          sections: { orderBy: { order: 'asc' } },
          revisions: { orderBy: { version: 'desc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      themeRevisions: { orderBy: { version: 'desc' } },
    } satisfies Prisma.WebsiteInclude;

    let website = await this.prisma.website.findUnique({
      where: { tenantId },
      include: baseWebsiteInclude,
    });

    if (!website) {
      const defaultTemplate = WEBSITE_TEMPLATE_LIBRARY[0];
      await this.prisma.website.create({
        data: {
          tenantId,
          themeConfig: (defaultTemplate?.themeConfig ?? DEFAULT_THEME) as Prisma.InputJsonValue,
          pages: {
            create: {
              slug: 'home',
              title: 'Home',
              isPublished: true,
              sections: {
                create: [
                  {
                    type: 'hero',
                    order: 0,
                    content: {
                      eyebrow: 'Welcome',
                      title: 'Welcome Home',
                      subtitle: 'Join us this Sunday and experience community.',
                      primaryCtaLabel: 'Plan Your Visit',
                      primaryCtaHref: '/new-here',
                    } as Prisma.InputJsonValue,
                  },
                ],
              },
            },
          },
        },
      });

      website = await this.prisma.website.findUnique({
        where: { tenantId },
        include: baseWebsiteInclude,
      });
    }

    if (!website) {
      throw new NotFoundException('Website could not be initialized.');
    }

    for (const page of website.pages) {
      if (page.revisions.length > 0) continue;

      const content = {
        blocks: page.sections.sort((a, b) => a.order - b.order).map((section) => this.sectionToBlock(section)),
      };

      await this.prisma.websitePageRevision.create({
        data: {
          pageId: page.id,
          version: 1,
          status: page.isPublished ? 'published' : 'draft',
          content: content as Prisma.InputJsonValue,
          seo: defaultSeoForPage(page.title, page.slug) as Prisma.InputJsonValue,
          changeSummary: 'Initial revision from legacy sections',
          createdBy: 'system-migration',
        },
      });
    }

    if (!website.themeRevisions.length) {
      await this.prisma.websiteThemeRevision.create({
        data: {
          websiteId: website.id,
          version: 1,
          status: 'published',
          themeConfig: ((website.themeConfig as Record<string, unknown> | null) ?? DEFAULT_THEME) as Prisma.InputJsonValue,
          changeSummary: 'Initial theme revision',
          createdBy: 'system-migration',
        },
      });
    }

    return this.prisma.website.findUniqueOrThrow({
      where: { tenantId },
      include: {
        pages: {
          include: {
            sections: { orderBy: { order: 'asc' } },
            revisions: { orderBy: { version: 'desc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
        themeRevisions: { orderBy: { version: 'desc' } },
        assets: { orderBy: { createdAt: 'desc' } },
        forms: { orderBy: { createdAt: 'desc' } },
        domains: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  private async syncSectionsFromBlocks(pageId: string, blocks: WebsiteBlock[]) {
    await this.prisma.section.deleteMany({ where: { pageId } });
    if (!blocks.length) return;

    await this.prisma.section.createMany({
      data: blocks.map((block, index) => ({
        pageId,
        type: block.type,
        order: index,
        content: block.settings as Prisma.InputJsonValue,
      })),
    });
  }

  private async resolveDynamicCount(tenantId: string, source: string) {
    const normalized = source.trim().toLowerCase();
    if (normalized === 'events') {
      return this.prisma.event.count({ where: { tenantId, startDate: { gte: new Date() } } });
    }
    if (normalized === 'staff') {
      return this.prisma.user.count({ where: { tenantId, status: 'Active' } });
    }
    if (normalized === 'announcements') {
      return this.prisma.message.count({ where: { tenantId, status: 'Sent' } });
    }
    if (normalized === 'giving') {
      return this.prisma.givingTransaction.count({ where: { tenantId } });
    }
    if (normalized === 'sermons') {
      return 0;
    }
    return 0;
  }

  private hasFallback(settings: Record<string, unknown>) {
    const fallback = settings.fallback;
    if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) return false;
    const candidate = fallback as Record<string, unknown>;
    const heading = typeof candidate.heading === 'string' && candidate.heading.trim();
    const body = typeof candidate.body === 'string' && candidate.body.trim();
    return Boolean(heading || body);
  }

  private async validateDynamicBlocks(tenantId: string, blocks: WebsiteBlock[]) {
    const errors: string[] = [];

    for (const block of blocks) {
      if (block.type !== 'dynamic_list') continue;

      const source = typeof block.settings.source === 'string' ? block.settings.source : '';
      if (!source) {
        errors.push(`Dynamic block ${block.id} is missing a source.`);
        continue;
      }

      const count = await this.resolveDynamicCount(tenantId, source);
      if (count <= 0 && !this.hasFallback(block.settings)) {
        errors.push(`Dynamic block ${block.id} (${source}) has no live data and no fallback.`);
      }
    }

    if (errors.length) {
      throw new BadRequestException({
        message: 'Publish validation failed for dynamic blocks.',
        errors,
      });
    }
  }

  private sanitizeDraftPayload(payload: SaveDraftPayload) {
    if (!payload.content || typeof payload.content !== 'object') {
      throw new BadRequestException('Draft content is required.');
    }

    const blocksInput = (payload.content as { blocks?: unknown }).blocks;
    const { blocks, warnings } = this.normalizeBlocks(blocksInput);
    return { blocks, warnings };
  }

  private normalizeTemplateSchema(template: WebsiteTemplateDefinition) {
    return {
      themeConfig: template.themeConfig,
      pages: template.pages,
    } satisfies Record<string, unknown>;
  }

  private websiteSnapshotPayload(website: Awaited<ReturnType<WebsiteService['ensureWebsite']>>) {
    return {
      id: website.id,
      tenantId: website.tenantId,
      themeConfig: website.themeConfig ?? DEFAULT_THEME,
      pages: website.pages.map((page) => {
        const revisions = sortByVersionDesc(page.revisions);
        const draftRevision = revisions.find((revision) => revision.status === 'draft') ?? null;
        const publishedRevision = revisions.find((revision) => revision.status === 'published') ?? null;

        const fallbackContent = {
          blocks: page.sections.sort((a, b) => a.order - b.order).map((section) => this.sectionToBlock(section)),
        };

        return {
          id: page.id,
          slug: page.slug,
          title: page.title,
          isPublished: page.isPublished,
          draftRevision,
          publishedRevision,
          revisions,
          sections: page.sections,
          effectiveContent: (draftRevision?.content as Record<string, unknown> | null) ?? (publishedRevision?.content as Record<string, unknown> | null) ?? fallbackContent,
          effectiveSeo: (draftRevision?.seo as Record<string, unknown> | null) ?? (publishedRevision?.seo as Record<string, unknown> | null) ?? defaultSeoForPage(page.title, page.slug),
        };
      }),
      themeRevisions: website.themeRevisions,
      assets: website.assets,
      forms: website.forms,
      domains: website.domains,
    };
  }

  async getWebsite(tenantId: string) {
    const website = await this.ensureWebsite(tenantId);
    return this.websiteSnapshotPayload(website);
  }

  async getTemplates() {
    await this.upsertTemplateCatalog();
    const templates = await this.prisma.websiteTemplate.findMany({
      where: { status: 'published' },
      orderBy: [{ family: 'asc' }, { name: 'asc' }],
    });

    return templates.map((template) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      family: template.family,
      status: template.status,
      description: template.description,
      previewImageUrl: template.previewImageUrl,
      schema: template.schema,
    }));
  }

  async applyTemplate(tenantId: string, templateKey: string, actorEmail?: string | null) {
    await this.upsertTemplateCatalog();

    const template = await this.prisma.websiteTemplate.findUnique({ where: { key: templateKey } });
    if (!template) {
      throw new NotFoundException('Template not found.');
    }

    const website = await this.ensureWebsite(tenantId);
    const schema = (template.schema as Record<string, unknown> | null) ?? this.normalizeTemplateSchema(WEBSITE_TEMPLATE_LIBRARY[0]);
    const templateTheme = (schema.themeConfig as Record<string, unknown> | undefined) ?? DEFAULT_THEME;
    const pages = Array.isArray(schema.pages) ? (schema.pages as unknown[]) : [];

    await this.prisma.$transaction(async (tx) => {
      await tx.section.deleteMany({ where: { page: { websiteId: website.id } } });
      await tx.websitePageRevision.deleteMany({ where: { page: { websiteId: website.id } } });
      await tx.page.deleteMany({ where: { websiteId: website.id } });

      for (const candidate of pages) {
        if (!candidate || typeof candidate !== 'object') continue;
        const pageTemplate = candidate as Record<string, unknown>;
        const rawSlug = typeof pageTemplate.slug === 'string' ? pageTemplate.slug : '';
        const slug = normalizeSlug(rawSlug);
        if (!slug) continue;
        const title = typeof pageTemplate.title === 'string' && pageTemplate.title.trim() ? pageTemplate.title.trim() : slug;

        const { blocks } = this.normalizeBlocks(pageTemplate.blocks);

        const page = await tx.page.create({
          data: {
            websiteId: website.id,
            slug,
            title,
            isPublished: slug === 'home',
          },
        });

        await tx.websitePageRevision.create({
          data: {
            pageId: page.id,
            version: 1,
            status: slug === 'home' ? 'published' : 'draft',
            content: { blocks } as Prisma.InputJsonValue,
            seo: sanitizeSeo(pageTemplate.seo, title, slug) as Prisma.InputJsonValue,
            changeSummary: `Template applied: ${template.name}`,
            createdBy: actorEmail ?? 'system',
          },
        });

        if (slug === 'home') {
          await tx.section.createMany({
            data: blocks.map((block, index) => ({
              pageId: page.id,
              type: block.type,
              order: index,
              content: block.settings as Prisma.InputJsonValue,
            })),
          });
        }
      }

      const currentMaxThemeVersion = await tx.websiteThemeRevision.aggregate({
        where: { websiteId: website.id },
        _max: { version: true },
      });
      const nextVersion = (currentMaxThemeVersion._max.version ?? 0) + 1;

      await tx.websiteThemeRevision.updateMany({
        where: { websiteId: website.id, status: 'published' },
        data: { status: 'archived' },
      });

      await tx.websiteThemeRevision.create({
        data: {
          websiteId: website.id,
          version: nextVersion,
          status: 'published',
          themeConfig: templateTheme as Prisma.InputJsonValue,
          changeSummary: `Theme from template ${template.name}`,
          createdBy: actorEmail ?? 'system',
        },
      });

      await tx.website.update({
        where: { id: website.id },
        data: {
          themeConfig: templateTheme as Prisma.InputJsonValue,
        },
      });

      await tx.websitePublishLog.create({
        data: {
          websiteId: website.id,
          actorEmail: actorEmail ?? null,
          action: 'template_apply',
          diff: {
            templateKey,
            templateName: template.name,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return this.getWebsite(tenantId);
  }

  async updateTheme(tenantId: string, themeConfig: Record<string, unknown>, actorEmail?: string | null) {
    const website = await this.ensureWebsite(tenantId);
    const mergedTheme = {
      ...(website.themeConfig as Record<string, unknown> | null),
      ...(themeConfig ?? {}),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.website.update({
        where: { id: website.id },
        data: {
          themeConfig: mergedTheme as Prisma.InputJsonValue,
        },
      });

      const maxVersion = await tx.websiteThemeRevision.aggregate({
        where: { websiteId: website.id },
        _max: { version: true },
      });

      await tx.websiteThemeRevision.updateMany({
        where: { websiteId: website.id, status: 'published' },
        data: { status: 'archived' },
      });

      await tx.websiteThemeRevision.create({
        data: {
          websiteId: website.id,
          version: (maxVersion._max.version ?? 0) + 1,
          status: 'published',
          themeConfig: mergedTheme as Prisma.InputJsonValue,
          changeSummary: 'Theme updated',
          createdBy: actorEmail ?? null,
        },
      });

      await tx.websitePublishLog.create({
        data: {
          websiteId: website.id,
          actorEmail: actorEmail ?? null,
          action: 'theme_publish',
          diff: {
            themeConfig: mergedTheme,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return this.getWebsite(tenantId);
  }

  async getGlobalSeoSettings(tenantId: string) {
    const website = await this.ensureWebsite(tenantId);
    const theme = (website.themeConfig as Record<string, unknown> | null) ?? {};
    const globalSeo = normalizeGlobalSeo(theme.globalSeo, defaultGlobalSeo());
    return globalSeo;
  }

  async updateGlobalSeoSettings(tenantId: string, payload: Record<string, unknown>, actorEmail?: string | null) {
    const website = await this.ensureWebsite(tenantId);
    const theme = (website.themeConfig as Record<string, unknown> | null) ?? {};
    const current = normalizeGlobalSeo(theme.globalSeo, defaultGlobalSeo());
    const nextGlobalSeo = normalizeGlobalSeo(payload, current);
    const nextTheme = {
      ...theme,
      globalSeo: nextGlobalSeo,
    };
    await this.updateTheme(tenantId, nextTheme, actorEmail);
    return nextGlobalSeo;
  }

  async createPage(tenantId: string, data: { slug: string; title: string }, actorEmail?: string | null) {
    const website = await this.ensureWebsite(tenantId);
    const slug = normalizeSlug(data.slug);
    if (!slug) {
      throw new BadRequestException('Page slug is required.');
    }

    const title = data.title?.trim();
    if (!title) {
      throw new BadRequestException('Page title is required.');
    }

    const existing = await this.prisma.page.findFirst({ where: { websiteId: website.id, slug } });
    if (existing) {
      throw new BadRequestException('A page with this slug already exists.');
    }

    const page = await this.prisma.page.create({
      data: {
        websiteId: website.id,
        slug,
        title,
        isPublished: false,
      },
    });

    await this.prisma.websitePageRevision.create({
      data: {
        pageId: page.id,
        version: 1,
        status: 'draft',
        content: { blocks: [] } as Prisma.InputJsonValue,
        seo: defaultSeoForPage(title, slug) as Prisma.InputJsonValue,
        changeSummary: 'Page created',
        createdBy: actorEmail ?? null,
      },
    });

    return page;
  }

  async updatePage(tenantId: string, pageId: string, data: { title?: string; isPublished?: boolean }) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, website: { tenantId } },
      select: { id: true, title: true, slug: true, isPublished: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found for this tenant.');
    }

    return this.prisma.page.update({
      where: { id: page.id },
      data: {
        title: data.title ?? undefined,
        isPublished: typeof data.isPublished === 'boolean' ? data.isPublished : undefined,
      },
    });
  }

  async addSection(tenantId: string, pageId: string, data: { type: string; content: Record<string, unknown>; order: number }) {
    const page = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        website: { tenantId },
      },
      select: { id: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found for this tenant.');
    }

    const blockPayload: WebsiteBlock = {
      id: randomUUID(),
      type: data.type as WebsiteBlock['type'],
      settings: data.content ?? {},
    };

    if (blockPayload.type === 'custom_fragment') {
      const html = typeof blockPayload.settings.html === 'string' ? blockPayload.settings.html : '';
      const sanitized = sanitizeHtmlFragment(html);
      blockPayload.settings = {
        ...blockPayload.settings,
        htmlOriginal: html,
        html: sanitized.sanitizedHtml,
        warnings: sanitized.warnings,
      };
    }

    const section = await this.prisma.section.create({
      data: {
        pageId,
        type: blockPayload.type,
        order: data.order,
        content: blockPayload.settings as Prisma.InputJsonValue,
      },
    });

    return section;
  }

  async getPageRevisions(tenantId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        website: { tenantId },
      },
      include: {
        revisions: { orderBy: { version: 'desc' } },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found for this tenant.');
    }

    return {
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
      },
      revisions: page.revisions,
    };
  }

  async savePageDraft(tenantId: string, pageId: string, payload: SaveDraftPayload) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, website: { tenantId } },
      include: {
        revisions: { orderBy: { version: 'desc' } },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found for this tenant.');
    }

    const { blocks, warnings } = this.sanitizeDraftPayload(payload);
    const maxVersion = page.revisions[0]?.version ?? 0;

    const revision = await this.prisma.websitePageRevision.create({
      data: {
        pageId: page.id,
        version: maxVersion + 1,
        status: 'draft',
        content: { blocks } as Prisma.InputJsonValue,
        seo: sanitizeSeo(payload.seo, payload.title ?? page.title, page.slug) as Prisma.InputJsonValue,
        changeSummary: payload.changeSummary?.trim() || 'Draft update',
        createdBy: payload.actorEmail ?? null,
      },
    });

    if (payload.title?.trim() && payload.title.trim() !== page.title) {
      await this.prisma.page.update({
        where: { id: page.id },
        data: { title: payload.title.trim() },
      });
    }

    return {
      revision,
      warnings,
    };
  }

  async publishPage(tenantId: string, pageId: string, actorEmail?: string | null) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, website: { tenantId } },
      include: {
        website: true,
        revisions: { orderBy: { version: 'desc' } },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found for this tenant.');
    }

    const latestDraft = page.revisions.find((revision) => revision.status === 'draft');
    const latestPublished = page.revisions.find((revision) => revision.status === 'published');
    const sourceRevision = latestDraft ?? latestPublished;

    if (!sourceRevision) {
      throw new BadRequestException('No revision available to publish.');
    }

    const blocksRaw = (sourceRevision.content as Record<string, unknown> | null)?.blocks;
    const { blocks } = this.normalizeBlocks(blocksRaw);

    await this.validateDynamicBlocks(tenantId, blocks);

    const nextVersion = (page.revisions[0]?.version ?? 0) + 1;
    const seoPayload = sanitizeSeo(sourceRevision.seo, page.title, page.slug);

    await this.prisma.$transaction(async (tx) => {
      await tx.websitePageRevision.updateMany({
        where: { pageId: page.id, status: 'published' },
        data: { status: 'archived' },
      });

      await tx.websitePageRevision.create({
        data: {
          pageId: page.id,
          version: nextVersion,
          status: 'published',
          content: { blocks } as Prisma.InputJsonValue,
          seo: seoPayload as Prisma.InputJsonValue,
          changeSummary: `Published from revision v${sourceRevision.version}`,
          createdBy: actorEmail ?? null,
        },
      });

      await tx.page.update({
        where: { id: page.id },
        data: { isPublished: true },
      });

      await this.syncSectionsFromBlocks(page.id, blocks);

      await tx.websitePublishLog.create({
        data: {
          websiteId: page.websiteId,
          pageId: page.id,
          actorEmail: actorEmail ?? null,
          action: 'publish',
          diff: {
            fromRevisionId: sourceRevision.id,
            fromVersion: sourceRevision.version,
            toVersion: nextVersion,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return this.getPageRevisions(tenantId, page.id);
  }

  async rollbackPage(tenantId: string, pageId: string, targetRevisionId: string | null, actorEmail?: string | null) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, website: { tenantId } },
      include: {
        website: true,
        revisions: { orderBy: { version: 'desc' } },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found for this tenant.');
    }

    const publishedRevisions = page.revisions.filter((revision) => revision.status === 'published' || revision.status === 'archived');
    if (!publishedRevisions.length) {
      throw new BadRequestException('No published history available for rollback.');
    }

    const target =
      (targetRevisionId ? publishedRevisions.find((revision) => revision.id === targetRevisionId) : null) ??
      publishedRevisions[0];

    if (!target) {
      throw new BadRequestException('Rollback target revision not found.');
    }

    const blocksRaw = (target.content as Record<string, unknown> | null)?.blocks;
    const { blocks } = this.normalizeBlocks(blocksRaw);

    const nextVersion = (page.revisions[0]?.version ?? 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.websitePageRevision.updateMany({
        where: { pageId: page.id, status: 'published' },
        data: { status: 'archived' },
      });

      await tx.websitePageRevision.create({
        data: {
          pageId: page.id,
          version: nextVersion,
          status: 'published',
          content: target.content === null ? Prisma.JsonNull : (target.content as Prisma.InputJsonValue),
          seo: target.seo === null ? Prisma.JsonNull : (target.seo as Prisma.InputJsonValue | undefined),
          changeSummary: `Rollback to v${target.version}`,
          createdBy: actorEmail ?? null,
        },
      });

      await this.syncSectionsFromBlocks(page.id, blocks);

      await tx.websitePublishLog.create({
        data: {
          websiteId: page.websiteId,
          pageId: page.id,
          actorEmail: actorEmail ?? null,
          action: 'rollback',
          diff: {
            toRevisionId: target.id,
            toVersion: target.version,
            newVersion: nextVersion,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return this.getPageRevisions(tenantId, page.id);
  }

  async createPreviewToken(tenantId: string, actorEmail?: string | null) {
    const website = await this.ensureWebsite(tenantId);
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.websitePreviewToken.create({
      data: {
        websiteId: website.id,
        token,
        expiresAt,
        createdBy: actorEmail ?? null,
      },
    });

    return {
      token,
      expiresAt,
    };
  }

  async getAssets(tenantId: string) {
    const website = await this.ensureWebsite(tenantId);
    return this.prisma.websiteAsset.findMany({
      where: {
        websiteId: website.id,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAsset(tenantId: string, payload: CreateAssetPayload) {
    const website = await this.ensureWebsite(tenantId);
    const name = payload.name?.trim();
    const url = payload.url?.trim();

    if (!name || !url) {
      throw new BadRequestException('Asset name and URL are required.');
    }

    return this.prisma.websiteAsset.create({
      data: {
        tenantId,
        websiteId: website.id,
        name,
        url,
        storageKey: payload.storageKey?.trim() || null,
        mimeType: payload.mimeType?.trim() || null,
        fileSizeBytes: typeof payload.fileSizeBytes === 'number' ? Math.max(0, Math.floor(payload.fileSizeBytes)) : null,
        altText: payload.altText?.trim() || null,
        createdBy: payload.actorEmail ?? null,
      },
    });
  }

  async deleteAsset(tenantId: string, assetId: string) {
    const asset = await this.prisma.websiteAsset.findFirst({
      where: {
        id: assetId,
        tenantId,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    await this.prisma.websiteAsset.delete({
      where: { id: asset.id },
    });

    return { ok: true };
  }

  async validateHtmlFragment(fragment: string) {
    const sanitized = sanitizeHtmlFragment(fragment);
    return {
      sanitizedHtml: sanitized.sanitizedHtml,
      warnings: sanitized.warnings,
      allowlistedIframeHosts: WEBSITE_EMBED_HOST_ALLOWLIST,
    };
  }

  async getForms(tenantId: string) {
    const website = await this.ensureWebsite(tenantId);
    const forms = await this.prisma.websiteForm.findMany({
      where: { websiteId: website.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    return forms.map((form) => ({
      ...form,
      submissionsCount: form._count.submissions,
    }));
  }

  async createForm(tenantId: string, payload: CreateFormPayload) {
    const website = await this.ensureWebsite(tenantId);
    const key = normalizeSlug(payload.key);
    const name = payload.name?.trim();

    if (!key || !name) {
      throw new BadRequestException('Form key and name are required.');
    }

    return this.prisma.websiteForm.upsert({
      where: {
        websiteId_key: {
          websiteId: website.id,
          key,
        },
      },
      create: {
        tenantId,
        websiteId: website.id,
        key,
        name,
        status: 'active',
        schema: (payload.schema ?? {}) as Prisma.InputJsonValue,
        notificationConfig: (payload.notificationConfig ?? {}) as Prisma.InputJsonValue,
        createdBy: payload.actorEmail ?? null,
      },
      update: {
        name,
        schema: (payload.schema ?? {}) as Prisma.InputJsonValue,
        notificationConfig: (payload.notificationConfig ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async getFormSubmissions(
    tenantId: string,
    options?: {
      status?: string;
      formKey?: string;
      limit?: number;
    },
  ) {
    const website = await this.ensureWebsite(tenantId);
    const normalizedStatus = options?.status?.trim().toLowerCase();
    const normalizedFormKey = options?.formKey ? normalizeSlug(options.formKey) : '';
    const limit = Math.max(1, Math.min(200, Math.floor(options?.limit ?? 100)));

    const submissions = await this.prisma.websiteFormSubmission.findMany({
      where: {
        websiteId: website.id,
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...(normalizedFormKey ? { form: { key: normalizedFormKey } } : {}),
      },
      include: {
        form: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return submissions.map((submission) => ({
      ...submission,
      payloadPreview: previewSubmissionFields(submission.payload),
    }));
  }

  async updateFormSubmissionStatus(
    tenantId: string,
    submissionId: string,
    status: string,
    actorEmail?: string | null,
  ) {
    const normalizedStatus = status.trim().toLowerCase();
    const allowed = new Set(['received', 'reviewed', 'resolved', 'quarantined', 'spam']);
    if (!allowed.has(normalizedStatus)) {
      throw new BadRequestException('Invalid submission status.');
    }

    const submission = await this.prisma.websiteFormSubmission.findFirst({
      where: { id: submissionId, tenantId },
      include: { website: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found.');
    }

    const updated = await this.prisma.websiteFormSubmission.update({
      where: { id: submission.id },
      data: {
        status: normalizedStatus,
      },
      include: {
        form: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    await this.prisma.websitePublishLog.create({
      data: {
        websiteId: submission.websiteId,
        actorEmail: actorEmail ?? null,
        action: 'form_submission_status',
        diff: {
          submissionId: submission.id,
          previousStatus: submission.status,
          nextStatus: normalizedStatus,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ...updated,
      payloadPreview: previewSubmissionFields(updated.payload),
    };
  }

  private async resolveWebsiteByDomain(domain: string) {
    const normalizedDomain = normalizeHost(domain);
    if (!normalizedDomain) {
      throw new NotFoundException('Church not found');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        domain: normalizedDomain,
      },
      select: { id: true },
    });

    if (tenant) {
      const website = await this.prisma.website.findUnique({ where: { tenantId: tenant.id } });
      if (website) {
        return website;
      }
    }

    const customDomain = await this.prisma.websiteDomain.findFirst({
      where: {
        hostname: normalizedDomain,
        status: 'verified',
      },
      include: {
        website: true,
      },
    });

    if (customDomain?.website) {
      return customDomain.website;
    }

    throw new NotFoundException('Church not found');
  }

  private async resolveWebsiteByDomainWithPolicy(domain: string) {
    const normalizedDomain = normalizeHost(domain);
    if (!normalizedDomain) {
      throw new NotFoundException('Church not found');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { domain: normalizedDomain },
      select: { id: true },
    });

    if (tenant) {
      const website = await this.prisma.website.findUnique({ where: { tenantId: tenant.id } });
      if (website) {
        return { website, redirectTo: null as string | null };
      }
    }

    const customDomain = await this.prisma.websiteDomain.findFirst({
      where: {
        hostname: normalizedDomain,
        status: 'verified',
      },
      include: {
        website: true,
      },
    });

    if (customDomain?.website) {
      const canonicalUrl = customDomain.canonicalUrl?.trim() || null;
      const canonicalHost = canonicalUrl ? normalizeHost(canonicalUrl) : '';
      const shouldRedirect =
        Boolean(customDomain.redirectToCanonical) &&
        Boolean(canonicalUrl) &&
        Boolean(canonicalHost) &&
        canonicalHost !== customDomain.hostname;

      return {
        website: customDomain.website,
        redirectTo: shouldRedirect ? canonicalUrl : null,
      };
    }

    throw new NotFoundException('Church not found');
  }

  private async dynamicListItems(tenantId: string, source: string, count: number) {
    const limit = Number.isFinite(count) ? Math.max(1, Math.min(20, Math.floor(count))) : 6;
    const normalized = source.trim().toLowerCase();

    if (normalized === 'events') {
      const rows = await this.prisma.event.findMany({
        where: { tenantId, startDate: { gte: new Date() } },
        orderBy: { startDate: 'asc' },
        take: limit,
      });
      return rows.map((row) => ({
        title: row.title,
        subtitle: row.description,
        date: row.startDate,
      }));
    }

    if (normalized === 'staff') {
      const rows = await this.prisma.user.findMany({
        where: { tenantId, status: 'Active' },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return rows.map((row) => ({
        title: row.name,
        subtitle: row.email,
      }));
    }

    if (normalized === 'announcements') {
      const rows = await this.prisma.message.findMany({
        where: { tenantId, status: 'Sent' },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map((row) => ({
        title: row.subject || row.type,
        subtitle: row.body,
      }));
    }

    if (normalized === 'giving') {
      const rows = await this.prisma.givingTransaction.findMany({
        where: { tenantId },
        orderBy: { transactionDate: 'desc' },
        take: limit,
      });
      return rows.map((row) => ({
        title: row.fund,
        subtitle: `${row.amount}`,
        date: row.transactionDate,
      }));
    }

    return [];
  }

  private async hydrateDynamicBlocks(tenantId: string, blocks: WebsiteBlock[]) {
    const next: WebsiteBlock[] = [];

    for (const block of blocks) {
      if (block.type !== 'dynamic_list') {
        next.push(block);
        continue;
      }

      const source = typeof block.settings.source === 'string' ? block.settings.source : '';
      const count = typeof block.settings.count === 'number' ? block.settings.count : 6;
      const items = source ? await this.dynamicListItems(tenantId, source, count) : [];

      next.push({
        ...block,
        settings: {
          ...block.settings,
          resolvedItems: items,
        },
      });
    }

    return next;
  }

  private async toPublicPages(websiteId: string, tenantId: string, includeDraft = false) {
    const pages = await this.prisma.page.findMany({
      where: { websiteId },
      include: {
        revisions: { orderBy: { version: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const resolved = [] as Array<{
      id: string;
      slug: string;
      title: string;
      sections: Array<{ id: string; type: string; content: Record<string, unknown> }>;
      seo: Record<string, unknown>;
    }>;

    for (const page of pages) {
      const revision = includeDraft
        ? page.revisions.find((entry) => entry.status === 'draft') ?? page.revisions.find((entry) => entry.status === 'published')
        : page.revisions.find((entry) => entry.status === 'published');

      if (!revision) continue;

      const blocksRaw = ((revision.content as Record<string, unknown> | null)?.blocks ?? []) as unknown[];
      const { blocks } = this.normalizeBlocks(blocksRaw);
      const hydrated = await this.hydrateDynamicBlocks(tenantId, blocks);
      const sections = hydrated.map((block) => ({
        id: block.id,
        type: block.type,
        content: block.settings,
      }));

      resolved.push({
        id: page.id,
        slug: page.slug,
        title: page.title,
        sections,
        seo: sanitizeSeo(revision.seo, page.title, page.slug),
      });
    }

    return resolved;
  }

  async getWebsiteByDomain(domain: string) {
    const context = await this.resolveWebsiteByDomainWithPolicy(domain);
    const website = context.website;
    const pages = await this.toPublicPages(website.id, website.tenantId, false);

    return {
      id: website.id,
      themeConfig: website.themeConfig ?? DEFAULT_THEME,
      pages,
      redirectTo: context.redirectTo,
    };
  }

  private getPublicBaseUrl(domain: string, themeConfig: Prisma.JsonValue | null) {
    const normalizedDomain = normalizeHost(domain);
    const defaultUrl = normalizedDomain ? `https://${normalizedDomain}` : '';
    const theme = themeConfig && typeof themeConfig === 'object' ? (themeConfig as Record<string, unknown>) : {};
    const globalSeo = normalizeGlobalSeo(theme.globalSeo, defaultGlobalSeo(defaultUrl));
    return globalSeo.canonicalBaseUrl?.trim() || defaultUrl;
  }

  async getWebsiteSitemapXml(domain: string) {
    const website = await this.resolveWebsiteByDomain(domain);
    const pages = await this.toPublicPages(website.id, website.tenantId, false);
    const baseUrl = this.getPublicBaseUrl(domain, website.themeConfig);

    const urls = pages.map((page) => {
      const path = page.slug === 'home' ? '' : `/${page.slug}`;
      const loc = `${baseUrl}${path}`;
      return `<url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>${page.slug === 'home' ? '1.0' : '0.8'}</priority></url>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
  }

  async getWebsiteRobotsTxt(domain: string) {
    const website = await this.resolveWebsiteByDomain(domain);
    const baseUrl = this.getPublicBaseUrl(domain, website.themeConfig);
    const theme = website.themeConfig && typeof website.themeConfig === 'object' ? (website.themeConfig as Record<string, unknown>) : {};
    const globalSeo = normalizeGlobalSeo(theme.globalSeo, defaultGlobalSeo(baseUrl));
    const robots = globalSeo.robotsIndex && globalSeo.robotsFollow ? 'index, follow' : 'noindex, nofollow';

    return `User-agent: *
Allow: /

# robots policy
X-Robots-Tag: ${robots}

Sitemap: ${baseUrl}/sitemap.xml`;
  }

  async getWebsitePreviewByToken(token: string) {
    const record = await this.prisma.websitePreviewToken.findUnique({
      where: { token },
      include: { website: true },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new NotFoundException('Preview token is invalid or expired.');
    }

    const pages = await this.toPublicPages(record.website.id, record.website.tenantId, true);
    return {
      id: record.website.id,
      themeConfig: record.website.themeConfig ?? DEFAULT_THEME,
      pages,
      preview: true,
      expiresAt: record.expiresAt,
    };
  }

  private async submissionBurstCount(formId: string, ipHash: string | null) {
    if (!ipHash) return 0;
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    return this.prisma.websiteFormSubmission.count({
      where: {
        formId,
        ipHash,
        createdAt: { gte: oneMinuteAgo },
      },
    });
  }

  async submitFormByDomain(domain: string, formKey: string, payload: SubmitFormPayload, ipAddress?: string, userAgent?: string) {
    const website = await this.resolveWebsiteByDomain(domain);

    const form = await this.prisma.websiteForm.findFirst({
      where: {
        websiteId: website.id,
        key: normalizeSlug(formKey),
        status: 'active',
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found.');
    }

    if (!payload || !payload.fields || typeof payload.fields !== 'object' || Array.isArray(payload.fields)) {
      throw new BadRequestException('Form fields are required.');
    }

    const ipHash = sha256(ipAddress);
    const userAgentHash = sha256(userAgent);

    const burstCount = await this.submissionBurstCount(form.id, ipHash);
    if (burstCount >= 4) {
      throw new BadRequestException('Too many submissions. Please try again shortly.');
    }

    const values = Object.values(payload.fields);
    let spamScore = 0;

    if (values.some((value) => typeof value === 'string' && value.length > 800)) {
      spamScore += 30;
    }
    if (values.some((value) => typeof value === 'string' && /https?:\/\//i.test(value))) {
      spamScore += 25;
    }

    const submission = await this.prisma.websiteFormSubmission.create({
      data: {
        tenantId: website.tenantId,
        websiteId: website.id,
        formId: form.id,
        payload: {
          fields: payload.fields,
          sourcePath: payload.sourcePath ?? null,
        } as Prisma.InputJsonValue,
        status: spamScore >= 40 ? 'quarantined' : 'received',
        spamScore,
        ipHash,
        userAgentHash,
      },
    });

    await this.trackAnalyticsByWebsite(website.id, website.tenantId, {
      pagePath: payload.sourcePath || '/',
      eventType: 'form_submit',
      source: form.key,
      payload: {
        formId: form.id,
      },
    }, ipAddress, userAgent);

    return {
      id: submission.id,
      status: submission.status,
      spamScore: submission.spamScore,
    };
  }

  async trackAnalyticsByDomain(domain: string, payload: TrackAnalyticsPayload, ipAddress?: string, userAgent?: string) {
    const website = await this.resolveWebsiteByDomain(domain);
    return this.trackAnalyticsByWebsite(website.id, website.tenantId, payload, ipAddress, userAgent);
  }

  private async trackAnalyticsByWebsite(
    websiteId: string,
    tenantId: string,
    payload: TrackAnalyticsPayload,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!payload.pagePath?.trim()) {
      throw new BadRequestException('pagePath is required.');
    }

    if (!['page_view', 'cta_click', 'form_submit'].includes(payload.eventType)) {
      throw new BadRequestException('Unsupported event type.');
    }

    const event = await this.prisma.websiteAnalyticsEvent.create({
      data: {
        websiteId,
        tenantId,
        pagePath: payload.pagePath.trim(),
        eventType: payload.eventType,
        source: payload.source?.trim() || null,
        payload: (payload.payload ?? {}) as Prisma.InputJsonValue,
        ipHash: sha256(ipAddress),
        userAgentHash: sha256(userAgent),
      },
    });

    return { id: event.id };
  }

  async getWebsiteAnalytics(tenantId: string, range?: string) {
    const website = await this.ensureWebsite(tenantId);
    const since = parseRangeToDate(range);
    const today = new Date();

    const [events, submissions] = await Promise.all([
      this.prisma.websiteAnalyticsEvent.findMany({
        where: {
          websiteId: website.id,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.websiteFormSubmission.findMany({
        where: {
          websiteId: website.id,
          createdAt: { gte: since },
        },
      }),
    ]);

    const totals = {
      events: events.length,
      pageViews: events.filter((event) => event.eventType === 'page_view').length,
      ctaClicks: events.filter((event) => event.eventType === 'cta_click').length,
      conversions: events.filter((event) => event.eventType === 'form_submit').length,
      formSubmissions: submissions.length,
    };

    const pageMap = new Map<string, { pagePath: string; pageViews: number; ctaClicks: number; conversions: number }>();
    for (const event of events) {
      const pagePath = event.pagePath || '/';
      const current = pageMap.get(pagePath) ?? { pagePath, pageViews: 0, ctaClicks: 0, conversions: 0 };
      if (event.eventType === 'page_view') current.pageViews += 1;
      if (event.eventType === 'cta_click') current.ctaClicks += 1;
      if (event.eventType === 'form_submit') current.conversions += 1;
      pageMap.set(pagePath, current);
    }

    const topPages = Array.from(pageMap.values())
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, 10);

    const sourceMap = new Map<string, number>();
    for (const event of events) {
      if (!event.source) continue;
      sourceMap.set(event.source, (sourceMap.get(event.source) ?? 0) + 1);
    }

    const timelineMap = new Map<
      string,
      { date: string; pageViews: number; ctaClicks: number; conversions: number; submissions: number }
    >();
    for (let cursor = new Date(since); cursor <= today; cursor = shiftDays(cursor, 1)) {
      const date = isoDay(cursor);
      timelineMap.set(date, { date, pageViews: 0, ctaClicks: 0, conversions: 0, submissions: 0 });
    }

    for (const event of events) {
      const date = isoDay(event.createdAt);
      const bucket = timelineMap.get(date);
      if (!bucket) continue;
      if (event.eventType === 'page_view') bucket.pageViews += 1;
      if (event.eventType === 'cta_click') bucket.ctaClicks += 1;
      if (event.eventType === 'form_submit') bucket.conversions += 1;
    }
    for (const submission of submissions) {
      const date = isoDay(submission.createdAt);
      const bucket = timelineMap.get(date);
      if (!bucket) continue;
      bucket.submissions += 1;
    }

    const timeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      range: range || '30d',
      since,
      totals,
      timeline,
      topPages,
      topSources: Array.from(sourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      recentEvents: events.slice(0, 30),
      recentSubmissions: submissions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20),
    };
  }

  async verifyDomain(tenantId: string, hostname: string) {
    const website = await this.ensureWebsite(tenantId);
    const normalized = normalizeHost(hostname);

    if (!normalized || normalized.includes(' ')) {
      throw new BadRequestException('Valid hostname is required.');
    }

    const existing = await this.prisma.websiteDomain.findUnique({ where: { hostname: normalized } });
    if (existing && existing.tenantId !== tenantId) {
      throw new BadRequestException('Domain is already in use by another tenant.');
    }

    const verificationToken = randomBytes(18).toString('hex');
    const isAutoVerified = normalized.endsWith('.noxera.plus');

    const domain = await this.prisma.websiteDomain.upsert({
      where: { hostname: normalized },
      create: {
        tenantId,
        websiteId: website.id,
        hostname: normalized,
        verificationToken,
        status: isAutoVerified ? 'verified' : 'pending',
        sslStatus: isAutoVerified ? 'active' : 'pending',
        verifiedAt: isAutoVerified ? new Date() : null,
        lastCheckedAt: new Date(),
      },
      update: {
        verificationToken,
        status: isAutoVerified ? 'verified' : 'pending',
        sslStatus: isAutoVerified ? 'active' : 'pending',
        verifiedAt: isAutoVerified ? new Date() : null,
        lastCheckedAt: new Date(),
      },
    });

    await this.prisma.websitePublishLog.create({
      data: {
        websiteId: website.id,
        actorEmail: null,
        action: 'domain_verify_requested',
        diff: {
          hostname: normalized,
          status: domain.status,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      domain,
      instructions: {
        type: 'TXT',
        host: `_noxera-verify.${normalized}`,
        value: verificationToken,
      },
    };
  }

  async getDomains(tenantId: string) {
    const website = await this.ensureWebsite(tenantId);
    return this.prisma.websiteDomain.findMany({
      where: {
        websiteId: website.id,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getDomainHealth(tenantId: string) {
    const website = await this.ensureWebsite(tenantId);
    const domains = await this.prisma.websiteDomain.findMany({
      where: { websiteId: website.id },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    const staleThresholdMs = 24 * 60 * 60 * 1000;
    const stale = domains.filter((domain) => {
      if (!domain.lastCheckedAt) return true;
      return now - domain.lastCheckedAt.getTime() > staleThresholdMs;
    });

    return {
      total: domains.length,
      verified: domains.filter((domain) => domain.status === 'verified').length,
      pending: domains.filter((domain) => domain.status === 'pending').length,
      failed: domains.filter((domain) => domain.status === 'failed').length,
      sslActive: domains.filter((domain) => domain.sslStatus === 'active').length,
      sslPending: domains.filter((domain) => domain.sslStatus === 'pending').length,
      staleChecks: stale.length,
      staleDomains: stale.map((domain) => ({
        id: domain.id,
        hostname: domain.hostname,
        lastCheckedAt: domain.lastCheckedAt,
        status: domain.status,
      })),
    };
  }

  private async hasVerificationRecord(domain: WebsiteDomain) {
    const host = `_noxera-verify.${domain.hostname}`;
    try {
      const records = await resolveTxt(host);
      const flattened = records.flatMap((row) => row).map((value) => value.trim());
      return flattened.some((value) => value === domain.verificationToken);
    } catch {
      return false;
    }
  }

  async checkDomain(tenantId: string, domainId: string) {
    const domain = await this.prisma.websiteDomain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found.');
    }

    let nextStatus: WebsiteDomain['status'] = domain.status;
    let nextSslStatus: WebsiteDomain['sslStatus'] = domain.sslStatus;
    let verifiedAt = domain.verifiedAt;
    const tokenFound = await this.hasVerificationRecord(domain);

    if (tokenFound) {
      nextStatus = 'verified';
      nextSslStatus = 'active';
      verifiedAt = new Date();
    } else if (domain.status === 'failed') {
      nextStatus = 'pending';
      nextSslStatus = 'pending';
      verifiedAt = null;
    } else if (domain.status === 'pending') {
      nextStatus = 'pending';
      nextSslStatus = 'pending';
      verifiedAt = null;
    }

    const updated = await this.prisma.websiteDomain.update({
      where: { id: domain.id },
      data: {
        status: nextStatus,
        sslStatus: nextSslStatus,
        verifiedAt,
        lastCheckedAt: new Date(),
      },
    });

    await this.prisma.websitePublishLog.create({
      data: {
        websiteId: domain.websiteId,
        actorEmail: null,
        action: 'domain_health_check',
        diff: {
          domainId: domain.id,
          hostname: domain.hostname,
          verificationRecordFound: tokenFound,
          statusBefore: domain.status,
          statusAfter: updated.status,
          sslBefore: domain.sslStatus,
          sslAfter: updated.sslStatus,
        } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async retryDomainCheck(tenantId: string, domainId: string) {
    await this.prisma.websiteDomain.updateMany({
      where: {
        id: domainId,
        tenantId,
      },
      data: {
        status: 'pending',
        sslStatus: 'pending',
      },
    });
    return this.checkDomain(tenantId, domainId);
  }

  async setPrimaryDomain(tenantId: string, domainId: string) {
    const domain = await this.prisma.websiteDomain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found.');
    }

    if (domain.status !== 'verified') {
      throw new BadRequestException('Only verified domains can be primary.');
    }

    await this.prisma.$transaction([
      this.prisma.websiteDomain.updateMany({
        where: { websiteId: domain.websiteId },
        data: { isPrimary: false },
      }),
      this.prisma.websiteDomain.update({
        where: { id: domain.id },
        data: { isPrimary: true },
      }),
    ]);

    return this.getDomains(tenantId);
  }

  async updateDomainRouting(
    tenantId: string,
    domainId: string,
    payload: {
      redirectToCanonical?: boolean;
      canonicalUrl?: string | null;
    },
    actorEmail?: string | null,
  ) {
    const domain = await this.prisma.websiteDomain.findFirst({
      where: { id: domainId, tenantId },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found.');
    }

    const redirectToCanonical =
      typeof payload.redirectToCanonical === 'boolean' ? payload.redirectToCanonical : domain.redirectToCanonical;
    const canonicalUrlRaw = typeof payload.canonicalUrl === 'string' ? payload.canonicalUrl.trim() : '';
    const canonicalUrl = canonicalUrlRaw || null;

    if (canonicalUrl) {
      try {
        const parsed = new URL(canonicalUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('invalid protocol');
        }
      } catch {
        throw new BadRequestException('Canonical URL must be a valid http(s) URL.');
      }
    }

    if (redirectToCanonical && !canonicalUrl) {
      throw new BadRequestException('Canonical URL is required when redirect is enabled.');
    }

    const updated = await this.prisma.websiteDomain.update({
      where: { id: domain.id },
      data: {
        redirectToCanonical,
        canonicalUrl,
      },
    });

    await this.prisma.websitePublishLog.create({
      data: {
        websiteId: domain.websiteId,
        actorEmail: actorEmail ?? null,
        action: 'domain_routing_update',
        diff: {
          domainId: domain.id,
          hostname: domain.hostname,
          redirectToCanonical,
          canonicalUrl,
        } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async deleteDomain(tenantId: string, domainId: string) {
    const domain = await this.prisma.websiteDomain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found.');
    }

    await this.prisma.websiteDomain.delete({ where: { id: domain.id } });

    return { ok: true };
  }
}
