import { Module } from '@nestjs/common';
import { CrewResolver } from './crew.resolver';
import { CrewService } from './crew.service';
import { StaffingResolver } from './staffing.resolver';
import { StaffingService } from './staffing.service';

@Module({
  providers: [StaffingResolver, StaffingService, CrewResolver, CrewService],
})
export class StaffingModule {}
