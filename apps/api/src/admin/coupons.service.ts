import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPagination, PaginatedResponse } from './admin.types';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCoupons(filters: { page?: unknown; limit?: unknown; search?: unknown }): Promise<PaginatedResponse<any>> {
    const pagination = getPagination(filters);
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';

    const where: any = {};
    if (search) {
      where.code = { contains: search, mode: 'insensitive' };
    }

    const [total, items] = await this.prisma.$transaction([
      (this.prisma as any).coupon.count({ where }),
      (this.prisma as any).coupon.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }

  async createCoupon(data: {
    code: string;
    discountType: string;
    discountValue: number;
    expiryDate?: string;
    usageLimit?: number;
  }) {
    const code = data.code.toUpperCase().trim();
    const existing = await (this.prisma as any).coupon.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('A coupon with this code already exists.');
    }

    return (this.prisma as any).coupon.create({
      data: {
        code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        usageLimit: data.usageLimit || null,
      },
    });
  }

  async deleteCoupon(id: string) {
    try {
      await (this.prisma as any).coupon.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Coupon not found.');
    }
    return { success: true };
  }

  async toggleCouponActive(id: string) {
    const coupon = await (this.prisma as any).coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found.');

    return (this.prisma as any).coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive },
    });
  }
}
