import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOperationalMonitoring1792790000000 implements MigrationInterface {
  name = 'AddOperationalMonitoring1792790000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ADD COLUMN "data_origin" varchar(12) NOT NULL DEFAULT 'manual'
    `);
    await queryRunner.query(`
      UPDATE "equipment" SET "data_origin" = 'demo' WHERE "serial_number" LIKE 'DEMO-%'
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment" ADD CONSTRAINT "chk_equipment_data_origin"
      CHECK ("data_origin" IN ('manual', 'demo'))
    `);
    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN "data_origin" varchar(12) NOT NULL DEFAULT 'manual'
    `);
    await queryRunner.query(`
      UPDATE "agents" SET "data_origin" = 'demo' WHERE "identifier" LIKE 'DEMO-%'
    `);
    await queryRunner.query(`
      ALTER TABLE "agents" ADD CONSTRAINT "chk_agents_data_origin"
      CHECK ("data_origin" IN ('manual', 'demo'))
    `);
    await queryRunner.query(`
      ALTER TABLE "agent_positions" ADD COLUMN "region_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "agent_positions" ADD CONSTRAINT "fk_agent_positions_region"
      FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "idx_agent_positions_region" ON "agent_positions" ("region_id")`);

    await queryRunner.query(`
      CREATE TABLE "operational_events" (
        "id" bigserial PRIMARY KEY,
        "event_type" varchar(50) NOT NULL,
        "resource_type" varchar(24) NOT NULL,
        "resource_id" uuid NOT NULL,
        "payload" jsonb NOT NULL,
        "source" varchar(16) NOT NULL DEFAULT 'api',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_operational_events_resource_type" CHECK ("resource_type" IN ('equipment', 'agent', 'maintenance', 'alert', 'demo_scenario')),
        CONSTRAINT "chk_operational_events_source" CHECK ("source" IN ('api', 'demo')),
        CONSTRAINT "chk_operational_events_payload_object" CHECK (jsonb_typeof("payload") = 'object')
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_operational_events_created_at" ON "operational_events" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "idx_operational_events_resource" ON "operational_events" ("resource_type", "resource_id", "id")`);

    await queryRunner.query(`
      CREATE TABLE "operational_alerts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "fingerprint" varchar(180) NOT NULL,
        "code" varchar(40) NOT NULL,
        "severity" varchar(12) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "title" varchar(160) NOT NULL,
        "description" varchar(500) NOT NULL,
        "resource_type" varchar(16) NOT NULL,
        "resource_id" uuid NOT NULL,
        "acknowledged_at" timestamptz,
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_operational_alerts_code" CHECK ("code" IN ('equipment_malfunctioning', 'equipment_unavailable', 'equipment_stolen', 'maintenance_immediate', 'maintenance_overdue')),
        CONSTRAINT "chk_operational_alerts_severity" CHECK ("severity" IN ('critical', 'high', 'medium', 'low')),
        CONSTRAINT "chk_operational_alerts_status" CHECK ("status" IN ('open', 'acknowledged', 'resolved')),
        CONSTRAINT "chk_operational_alerts_resource_type" CHECK ("resource_type" IN ('equipment', 'maintenance')),
        CONSTRAINT "chk_operational_alerts_state_timestamps" CHECK (("status" = 'resolved') = ("resolved_at" IS NOT NULL))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_operational_alerts_active_fingerprint" ON "operational_alerts" ("fingerprint") WHERE "resolved_at" IS NULL`);
    await queryRunner.query(`CREATE INDEX "idx_operational_alerts_status_severity_created" ON "operational_alerts" ("status", "severity", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "idx_operational_alerts_resource" ON "operational_alerts" ("resource_type", "resource_id", "status")`);

    await queryRunner.query(`
      CREATE TABLE "operational_alert_actions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "alert_id" uuid NOT NULL,
        "type" varchar(16) NOT NULL,
        "note" varchar(500),
        "actor" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_operational_alert_actions_alert" FOREIGN KEY ("alert_id") REFERENCES "operational_alerts"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_operational_alert_actions_type" CHECK ("type" IN ('created', 'acknowledged', 'note', 'resolved'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_operational_alert_actions_alert_created" ON "operational_alert_actions" ("alert_id", "created_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "operational_alert_actions"');
    await queryRunner.query('DROP TABLE "operational_alerts"');
    await queryRunner.query('DROP TABLE "operational_events"');
    await queryRunner.query('DROP INDEX "idx_agent_positions_region"');
    await queryRunner.query('ALTER TABLE "agent_positions" DROP CONSTRAINT "fk_agent_positions_region"');
    await queryRunner.query('ALTER TABLE "agent_positions" DROP COLUMN "region_id"');
    await queryRunner.query('ALTER TABLE "agents" DROP CONSTRAINT "chk_agents_data_origin"');
    await queryRunner.query('ALTER TABLE "agents" DROP COLUMN "data_origin"');
    await queryRunner.query('ALTER TABLE "equipment" DROP CONSTRAINT "chk_equipment_data_origin"');
    await queryRunner.query('ALTER TABLE "equipment" DROP COLUMN "data_origin"');
  }
}
