import { Controller, Get, Post, Body, Headers } from '@nestjs/common';

@Controller('integrations')
export class IntegrationsController {
  @Post('google-calendar/sync')
  async syncGoogleCalendar(@Headers() headers: any) {
    return { status: 'success', message: 'Sync initiated' };
  }

  @Post('accounting/export')
  async exportToAccounting(@Headers() headers: any, @Body() body: { format: string }) {
    return { status: 'success', downloadUrl: 'https://example.com/export.csv' };
  }

  @Get('active')
  async getActiveIntegrations(@Headers() headers: any) {
    return [
      { id: '1', name: 'Google Calendar', status: 'Connected' },
      { id: '2', name: 'Stripe', status: 'Connected' },
      { id: '3', name: 'WhatsApp Business', status: 'Not Connected' },
    ];
  }
}
