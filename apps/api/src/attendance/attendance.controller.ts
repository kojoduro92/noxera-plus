import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';
import { resolveReadBranchScope, resolveWriteBranchScope } from '../auth/branch-scope';

@UseGuards(AdminGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  async createAttendanceRecord(
    @Req() request: RequestWithAuth,
    @Body() body: { serviceId: string; memberId?: string; visitorId?: string; method?: string; branchId?: string },
  ) {
    const session = request.authContext!;
    const scope = resolveWriteBranchScope(session, body.branchId);
    return this.attendanceService.createAttendanceRecord(
      session.tenantId!,
      { ...body, branchId: scope.branchId },
      session.branchScopeMode === 'RESTRICTED' ? session.allowedBranchIds : undefined,
    );
  }

  @Get()
  async getAttendanceRecords(@Req() request: RequestWithAuth, @Query('branchId') branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.attendanceService.getAttendanceRecords(
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get('service/:serviceId')
  async getAttendanceByService(@Req() request: RequestWithAuth, @Param('serviceId') serviceId: string, @Query('branchId') branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.attendanceService.getAttendanceByService(
      serviceId,
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }

  @Get(':id')
  async getAttendanceRecordById(@Req() request: RequestWithAuth, @Param('id') id: string, @Query('branchId') branchId?: string) {
    const session = request.authContext!;
    const scope = resolveReadBranchScope(session, branchId);
    return this.attendanceService.getAttendanceRecordById(
      id,
      session.tenantId!,
      scope.branchId,
      session.branchScopeMode === 'RESTRICTED' ? (scope.allowedBranchIds ?? session.allowedBranchIds) : undefined,
    );
  }
}
