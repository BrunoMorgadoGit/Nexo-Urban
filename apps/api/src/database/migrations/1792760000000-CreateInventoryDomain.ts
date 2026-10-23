import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryDomain1792760000000 implements MigrationInterface {
  name = 'CreateInventoryDomain1792760000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "name" varchar(120) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_organizations_code" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "regions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "name" varchar(100) NOT NULL,
        "zone" varchar(50) NOT NULL,
        "city" varchar(100) NOT NULL,
        "state" char(2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_regions_code" UNIQUE ("code"),
        CONSTRAINT "uq_regions_city_state_name" UNIQUE ("city", "state", "name"),
        CONSTRAINT "chk_regions_state" CHECK ("state" ~ '^[A-Z]{2}$')
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "equipment_types" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(60) NOT NULL,
        "label" varchar(100) NOT NULL,
        "mobility" varchar(20) NOT NULL,
        "characteristics_schema" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_equipment_types_code" UNIQUE ("code"),
        CONSTRAINT "chk_equipment_types_mobility" CHECK ("mobility" IN ('fixed', 'mobile'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "equipment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type_code" varchar(60) NOT NULL,
        "serial_number" varchar(80) NOT NULL,
        "brand" varchar(80) NOT NULL,
        "model" varchar(100) NOT NULL,
        "organization_id" uuid NOT NULL,
        "status" varchar(30) NOT NULL,
        "maintenance_priority" varchar(20) NOT NULL,
        "next_maintenance_date" date,
        "characteristics" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_equipment_serial_number" UNIQUE ("serial_number"),
        CONSTRAINT "fk_equipment_type" FOREIGN KEY ("type_code") REFERENCES "equipment_types"("code") ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT "fk_equipment_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_equipment_status" CHECK ("status" IN ('not_installed', 'operational', 'malfunctioning', 'maintenance', 'deactivated', 'stolen')),
        CONSTRAINT "chk_equipment_maintenance_priority" CHECK ("maintenance_priority" IN ('low', 'normal', 'high', 'immediate')),
        CONSTRAINT "chk_equipment_characteristics_object" CHECK (jsonb_typeof("characteristics") = 'object')
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "equipment_locations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "equipment_id" uuid NOT NULL,
        "postal_code" varchar(9) NOT NULL,
        "street" varchar(160) NOT NULL,
        "reference" varchar(100) NOT NULL,
        "region_id" uuid NOT NULL,
        "city" varchar(100) NOT NULL,
        "state" char(2) NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "role" varchar(10) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_equipment_locations_equipment" UNIQUE ("equipment_id"),
        CONSTRAINT "fk_equipment_locations_equipment" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_equipment_locations_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_equipment_locations_postal_code" CHECK ("postal_code" ~ '^[0-9]{5}-?[0-9]{3}$'),
        CONSTRAINT "chk_equipment_locations_state" CHECK ("state" ~ '^[A-Z]{2}$'),
        CONSTRAINT "chk_equipment_locations_latitude" CHECK ("latitude" BETWEEN -90 AND 90),
        CONSTRAINT "chk_equipment_locations_longitude" CHECK ("longitude" BETWEEN -180 AND 180),
        CONSTRAINT "chk_equipment_locations_role" CHECK ("role" IN ('fixed', 'base'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "equipment_positions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "equipment_id" uuid NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "recorded_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_equipment_positions_equipment" UNIQUE ("equipment_id"),
        CONSTRAINT "fk_equipment_positions_equipment" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_equipment_positions_latitude" CHECK ("latitude" BETWEEN -90 AND 90),
        CONSTRAINT "chk_equipment_positions_longitude" CHECK ("longitude" BETWEEN -180 AND 180)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "identifier" varchar(40) NOT NULL,
        "category" varchar(30) NOT NULL,
        "organization_id" uuid NOT NULL,
        "availability" varchar(20) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_agents_identifier" UNIQUE ("identifier"),
        CONSTRAINT "fk_agents_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_agents_category" CHECK ("category" IN ('traffic_agent', 'municipal_guard', 'police_officer')),
        CONSTRAINT "chk_agents_availability" CHECK ("availability" IN ('available', 'on_duty', 'unavailable', 'off_duty'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "agent_positions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" uuid NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "recorded_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_agent_positions_agent" UNIQUE ("agent_id"),
        CONSTRAINT "fk_agent_positions_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_agent_positions_latitude" CHECK ("latitude" BETWEEN -90 AND 90),
        CONSTRAINT "chk_agent_positions_longitude" CHECK ("longitude" BETWEEN -180 AND 180)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "maintenances" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "equipment_id" uuid NOT NULL,
        "kind" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'scheduled',
        "priority" varchar(20) NOT NULL,
        "description" varchar(500) NOT NULL,
        "scheduled_date" date NOT NULL,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_maintenances_equipment" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_maintenances_kind" CHECK ("kind" IN ('immediate', 'scheduled', 'periodic')),
        CONSTRAINT "chk_maintenances_status" CHECK ("status" IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
        CONSTRAINT "chk_maintenances_priority" CHECK ("priority" IN ('low', 'normal', 'high', 'immediate'))
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_equipment_status_type" ON "equipment" ("status", "type_code")');
    await queryRunner.query('CREATE INDEX "idx_equipment_organization" ON "equipment" ("organization_id")');
    await queryRunner.query('CREATE INDEX "idx_equipment_location_region" ON "equipment_locations" ("region_id")');
    await queryRunner.query('CREATE INDEX "idx_equipment_position_recorded_at" ON "equipment_positions" ("recorded_at")');
    await queryRunner.query('CREATE INDEX "idx_agents_organization_availability" ON "agents" ("organization_id", "availability")');
    await queryRunner.query('CREATE INDEX "idx_agent_position_recorded_at" ON "agent_positions" ("recorded_at")');
    await queryRunner.query('CREATE INDEX "idx_maintenances_status_date" ON "maintenances" ("status", "scheduled_date")');
    await queryRunner.query('CREATE INDEX "idx_maintenances_equipment" ON "maintenances" ("equipment_id", "scheduled_date")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "maintenances"');
    await queryRunner.query('DROP TABLE "agent_positions"');
    await queryRunner.query('DROP TABLE "agents"');
    await queryRunner.query('DROP TABLE "equipment_positions"');
    await queryRunner.query('DROP TABLE "equipment_locations"');
    await queryRunner.query('DROP TABLE "equipment"');
    await queryRunner.query('DROP TABLE "equipment_types"');
    await queryRunner.query('DROP TABLE "regions"');
    await queryRunner.query('DROP TABLE "organizations"');
  }
}
