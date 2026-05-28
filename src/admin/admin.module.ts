import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { ClusteringService } from './clustering.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, ClusteringService],
  exports: [ClusteringService],
})
export class AdminModule {}

