import { Module } from '@nestjs/common';
import { BranchGeofencesController } from './branch-geofences.controller';
import { BranchGeofencesService } from './branch-geofences.service';
import { BranchWifiConfigsController } from './branch-wifi-configs.controller';
import { BranchWifiConfigsService } from './branch-wifi-configs.service';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  controllers: [
    BranchesController,
    BranchWifiConfigsController,
    BranchGeofencesController,
  ],
  providers: [
    BranchesService,
    BranchWifiConfigsService,
    BranchGeofencesService,
  ],
  exports: [BranchesService],
})
export class BranchesModule {}
