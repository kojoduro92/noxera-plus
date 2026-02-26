import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AuthModule } from '../auth/auth.module';
import { PublicTenantsController } from './public-tenants.controller';

@Module({
  imports: [AuthModule],
  providers: [TenantsService],
  controllers: [TenantsController, PublicTenantsController],
})
export class TenantsModule {}
