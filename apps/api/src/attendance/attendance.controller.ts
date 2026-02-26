import { Controller, Post, Get, Body, Param, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  private getTenantId(headers: any) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId) throw new UnauthorizedException('Missing x-tenant-id header');
    return tenantId;
  }

  @Post()
  async createAttendanceRecord(
    @Headers() headers: any,
    @Body() body: { serviceId: string; memberId?: string; visitorId?: string; method?: string; branchId?: string },
  ) {
    const tenantId = this.getTenantId(headers);
    return this.attendanceService.createAttendanceRecord(tenantId, body);
  }

  @Get()
  async getAttendanceRecords(@Headers() headers: any, @Query('branchId') branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.attendanceService.getAttendanceRecords(tenantId, branchId);
  }

  @Get(':id')
  async getAttendanceRecordById(@Headers() headers: any, @Param('id') id: string, @Query('branchId') branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.attendanceService.getAttendanceRecordById(id, tenantId, branchId);
  }

  @Get('service/:serviceId')
  async getAttendanceByService(@Headers() headers: any, @Param('serviceId') serviceId: string, @Query('branchId') branchId?: string) {
    const tenantId = this.getTenantId(headers);
    return this.attendanceService.getAttendanceByService(serviceId, tenantId, branchId);
  }
}
