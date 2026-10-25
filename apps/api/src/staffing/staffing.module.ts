import { Module } from '@nestjs/common';
import { StaffingResolver } from './staffing.resolver';
import { StaffingService } from './staffing.service';

@Module({ providers: [StaffingResolver, StaffingService] })
export class StaffingModule {}
