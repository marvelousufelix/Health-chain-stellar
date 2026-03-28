import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DonationEntity } from './entities/donation.entity';
import { DonationService } from './services/donation.service';
import { DonationController } from './controllers/donation.controller';
import { SorobanModule } from '../soroban/soroban.module';
import { UserActivityModule } from '../user-activity/user-activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DonationEntity]),
    SorobanModule,
    UserActivityModule,
  ],
  providers: [DonationService],
  controllers: [DonationController],
  exports: [DonationService],
})
export class DonationModule {}
