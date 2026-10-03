import { Module } from '@nestjs/common';
import { VesselsResolver } from './vessels.resolver';
import { VesselsService } from './vessels.service';

@Module({
  providers: [VesselsResolver, VesselsService],
})
export class VesselsModule {}
