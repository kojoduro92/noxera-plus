import { Controller, Post, Get, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  private getTenantId(headers: any) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId) throw new UnauthorizedException('Missing x-tenant-id header');
    return tenantId;
  }

  @Post()
  async createService(
    @Headers() headers: any,
    @Body() body: { name: string; date: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    return this.servicesService.createService(tenantId, body);
  }

  @Get()
  async getServices(@Headers() headers: any) {
    const tenantId = this.getTenantId(headers);
    const branchId = headers["x-branch-id"];
    return this.servicesService.getServices(tenantId, branchId);
  }

  @Get(':id')
  async getServiceById(@Headers() headers: any, @Param('id') id: string) {
    const tenantId = this.getTenantId(headers);
    const branchId = headers["x-branch-id"];
    return this.servicesService.getServiceById(id, tenantId, branchId);
  }
}
