import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  private resolvePlanPrice(planName: string): number {
    const normalized = planName.trim().toLowerCase();
    if (normalized === 'basic') return 49;
    if (normalized === 'pro') return 99;
    if (normalized === 'enterprise') return 199;
    return 0;
  }

  async createTenant(data: { churchName: string; domain: string; plan: string; adminEmail: string; branchName?: string }) {
    // 1. Validate if domain already exists
    const existing = await this.prisma.tenant.findUnique({
      where: { domain: data.domain },
    });

    if (existing) {
      throw new BadRequestException('Domain is already taken');
    }

    // 2. Ensure requested plan exists so onboarding creates consistent billing metadata
    const plan = await this.prisma.plan.upsert({
      where: { name: data.plan },
      update: {},
      create: {
        name: data.plan,
        price: this.resolvePlanPrice(data.plan),
        modules: [],
        limits: {},
      },
    });

    // 3. Create Tenant and default Admin User and optionally a default branch
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.churchName,
        domain: data.domain,
        planId: plan.id,
        users: {
          create: {
            email: data.adminEmail,
            name: 'Admin User',
            // Defaulting role assignment logic goes here (e.g. attaching Owner Role)
          },
        },
        branches: data.branchName ? {
          create: { name: data.branchName, location: "Main Campus" }
        } : undefined,
      },
    });

    return tenant;
  }

  async getTenants() {
    return this.prisma.tenant.findMany({
      include: { plan: true },
    });
  }

  async getTenantById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
    });
  }

  async getPlatformMetrics() {
    const totalChurches = await this.prisma.tenant.count();
    const activeChurches = await this.prisma.tenant.count({
      where: { status: 'Active' },
    });
    
    // Sum of prices of all active tenants' plans (simulated MRR)
    const activeTenantsWithPlans = await this.prisma.tenant.findMany({
      where: { status: 'Active' },
      include: { plan: true },
    });

    const mrr = activeTenantsWithPlans.reduce((acc, t) => acc + (t.plan?.price || 0), 0);

    return {
      totalChurches,
      activeChurches,
      mrr,
    };
  }

  async updateTenantStatus(id: string, status: string) {
    return this.prisma.tenant.update({
      where: { id },
      data: { status },
    });
  }
}
