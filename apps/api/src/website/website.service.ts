import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebsiteService {
  constructor(private prisma: PrismaService) {}

  async getWebsite(tenantId: string) {
    let website = await this.prisma.website.findUnique({
      where: { tenantId },
      include: { pages: { include: { sections: true } } },
    });

    if (!website) {
      // Create a default website if it doesn't exist
      website = await this.prisma.website.create({
        data: {
          tenantId,
          themeConfig: { primaryColor: '#4f46e5', font: 'Inter' },
          pages: {
            create: {
              slug: 'home',
              title: 'Home',
              isPublished: true,
              sections: {
                create: {
                  type: 'hero',
                  order: 0,
                  content: { title: 'Welcome', subtitle: 'Join us this Sunday' },
                },
              },
            },
          },
        },
        include: { pages: { include: { sections: true } } },
      });
    }

    return website;
  }

  async updateTheme(tenantId: string, themeConfig: any) {
    return this.prisma.website.update({
      where: { tenantId },
      data: { themeConfig },
    });
  }

  async createPage(tenantId: string, data: { slug: string; title: string }) {
    const website = await this.getWebsite(tenantId);
    return this.prisma.page.create({
      data: {
        websiteId: website.id,
        slug: data.slug,
        title: data.title,
      },
    });
  }

  async updatePage(pageId: string, data: { title?: string; isPublished?: boolean }) {
    return this.prisma.page.update({
      where: { id: pageId },
      data,
    });
  }

  async addSection(pageId: string, data: { type: string; content: any; order: number }) {
    return this.prisma.section.create({
      data: {
        pageId,
        type: data.type,
        content: data.content,
        order: data.order,
      },
    });
  }
}
