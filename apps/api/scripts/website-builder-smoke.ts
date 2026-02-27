import { PrismaService } from '../src/prisma/prisma.service';
import { WebsiteService } from '../src/website/website.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const service = new WebsiteService(prisma);

  const suffix = Date.now().toString().slice(-8);
  const domain = `smoke-${suffix}.noxera.plus`;

  const tenant = await prisma.tenant.create({
    data: {
      name: `Smoke Tenant ${suffix}`,
      domain,
      features: [],
      status: 'Active',
    },
  });

  try {
    const templates = await service.getTemplates();
    if (!templates.length) {
      throw new Error('No templates returned from getTemplates');
    }

    await service.applyTemplate(tenant.id, templates[0].key, 'smoke@noxera.plus');

    const website = await service.getWebsite(tenant.id);
    if (!website.pages.length) {
      throw new Error('No pages returned after template apply');
    }

    const page = await service.createPage(tenant.id, { slug: 'campaign', title: 'Campaign' }, 'smoke@noxera.plus');

    await service.savePageDraft(tenant.id, page.id, {
      title: 'Campaign',
      content: {
        blocks: [
          {
            id: 'hero-campaign',
            type: 'hero',
            settings: {
              eyebrow: 'Campaign',
              title: 'Serve The City',
              subtitle: 'Join our outreach efforts this month.',
              primaryCtaLabel: 'Volunteer',
              primaryCtaHref: '/contact',
            },
          },
        ],
      },
      seo: {
        title: 'Serve The City',
        description: 'Outreach campaign page',
      },
      changeSummary: 'smoke draft',
      actorEmail: 'smoke@noxera.plus',
    });

    await service.publishPage(tenant.id, page.id, 'smoke@noxera.plus');

    const preview = await service.createPreviewToken(tenant.id, 'smoke@noxera.plus');
    if (!preview.token) {
      throw new Error('Preview token not generated');
    }

    const publicPayload = await service.getWebsiteByDomain(domain);
    if (!publicPayload.pages.length) {
      throw new Error('Public payload has no pages');
    }

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          tenantId: tenant.id,
          domain,
          templateCount: templates.length,
          pages: publicPayload.pages.length,
          previewToken: preview.token,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
