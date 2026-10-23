import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { EquipmentModule } from './equipment/equipment.module.js';
import { EquipmentTypesModule } from './equipment-types/equipment-types.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { RegionsModule } from './regions/regions.module.js';
import { validateEnvironment } from './config/environment.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    HealthModule,
    EquipmentTypesModule,
    OrganizationsModule,
    RegionsModule,
    EquipmentModule,
    AgentsModule,
    MaintenanceModule,
    InventoryModule,
  ],
})
export class AppModule {}
