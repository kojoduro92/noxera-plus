import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { SupportService } from './support.service';

type SuperAdminRequest = {
  superAdmin?: {
    email?: string;
  };
};

@Controller('support')
@UseGuards(SuperAdminGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  async createTicket(
    @Req() request: SuperAdminRequest,
    @Body()
    body: {
      tenantId: string;
      subject: string;
      description: string;
      status?: string;
      priority?: string;
      assignedTo?: string;
    },
  ) {
    return this.supportService.createTicket(body, request.superAdmin?.email ?? 'unknown');
  }

  @Get('tickets')
  async getTickets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
  ) {
    return this.supportService.listTickets({
      page,
      limit,
      status,
      tenantId,
      priority,
      search,
    });
  }

  @Get('tickets/:id')
  async getTicketById(@Param('id') id: string) {
    return this.supportService.getTicketById(id);
  }

  @Patch('tickets/:id/status')
  async updateTicketStatus(
    @Param('id') id: string,
    @Req() request: SuperAdminRequest,
    @Body() body: { status: string },
  ) {
    return this.supportService.updateStatus(id, body.status, request.superAdmin?.email ?? 'unknown');
  }

  @Patch('tickets/:id/assign')
  async assignTicket(
    @Param('id') id: string,
    @Req() request: SuperAdminRequest,
    @Body() body: { assignedTo: string },
  ) {
    return this.supportService.assignTicket(id, body.assignedTo, request.superAdmin?.email ?? 'unknown');
  }
}
