import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { CouponsService } from './coupons.service';

@UseGuards(SuperAdminGuard)
@Controller('billing/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async listCoupons(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.couponsService.listCoupons({ page, limit, search });
  }

  @Post()
  async createCoupon(
    @Body() body: {
      code: string;
      discountType: string;
      discountValue: number;
      expiryDate?: string;
      usageLimit?: number;
    },
  ) {
    return this.couponsService.createCoupon(body);
  }

  @Patch(':id/active')
  async toggleCouponActive(@Param('id') id: string) {
    return this.couponsService.toggleCouponActive(id);
  }

  @Delete(':id')
  async deleteCoupon(@Param('id') id: string) {
    return this.couponsService.deleteCoupon(id);
  }
}
