import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithAuth } from '../auth/auth.types';

@UseGuards(AdminGuard)
@Controller('integrations')
export class IntegrationsController {
  @Post('google-calendar/sync')
  async syncGoogleCalendar(@Req() request: RequestWithAuth) {
    return { status: 'success', message: 'Sync initiated' };
  }

  @Post('accounting/export')
  async exportToAccounting(@Req() request: RequestWithAuth, @Body() body: { format: string }) {
    return { status: 'success', downloadUrl: 'https://example.com/export.csv' };
  }

  @Get('active')
  async getActiveIntegrations(@Req() request: RequestWithAuth) {
    return [
      { id: '1', name: 'Google Calendar', status: 'Connected' },
      { id: '2', name: 'Stripe', status: 'Connected' },
      { id: '3', name: 'WhatsApp Business', status: 'Not Connected' },
    ];
  }
}
