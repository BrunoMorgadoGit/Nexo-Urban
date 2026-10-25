import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendOperationalAgents1793010000000 implements MigrationInterface {
  name = 'ExtendOperationalAgents1793010000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "operational_bases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "region_id" uuid,
        "latitude" double precision,
        "longitude" double precision,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_operational_bases_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_operational_bases_coordinates_pair" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
        CONSTRAINT "chk_operational_bases_latitude" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
        CONSTRAINT "chk_operational_bases_longitude" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_operational_bases_region" ON "operational_bases" ("region_id")');
    await queryRunner.query('ALTER TABLE "agents" ADD COLUMN "operational_base_id" uuid');
    await queryRunner.query('ALTER TABLE "agents" ADD COLUMN "equipment_id" uuid');
    await queryRunner.query('ALTER TABLE "agents" ADD COLUMN "operational_notes" varchar(500)');
    await queryRunner.query('ALTER TABLE "agents" ADD CONSTRAINT "fk_agents_operational_base" FOREIGN KEY ("operational_base_id") REFERENCES "operational_bases"("id") ON DELETE SET NULL');
    await queryRunner.query('ALTER TABLE "agents" ADD CONSTRAINT "fk_agents_equipment" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL');
    await queryRunner.query('CREATE INDEX "idx_agents_operational_base" ON "agents" ("operational_base_id")');
    await queryRunner.query('CREATE INDEX "idx_agents_equipment" ON "agents" ("equipment_id")');
    await queryRunner.query('ALTER TABLE "agents" DROP CONSTRAINT "chk_agents_category"');
    await queryRunner.query(`
      ALTER TABLE "agents" ADD CONSTRAINT "chk_agents_category"
      CHECK ("category" IN ('traffic_agent', 'municipal_guard', 'police_officer', 'military_police_officer', 'civil_police_officer', 'other'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "agents" SET "category" = 'police_officer'
      WHERE "category" IN ('military_police_officer', 'civil_police_officer', 'other')
    `);
    await queryRunner.query('ALTER TABLE "agents" DROP CONSTRAINT "chk_agents_category"');
    await queryRunner.query(`
      ALTER TABLE "agents" ADD CONSTRAINT "chk_agents_category"
      CHECK ("category" IN ('traffic_agent', 'municipal_guard', 'police_officer'))
    `);
    await queryRunner.query('DROP INDEX "idx_agents_equipment"');
    await queryRunner.query('DROP INDEX "idx_agents_operational_base"');
    await queryRunner.query('ALTER TABLE "agents" DROP CONSTRAINT "fk_agents_equipment"');
    await queryRunner.query('ALTER TABLE "agents" DROP CONSTRAINT "fk_agents_operational_base"');
    await queryRunner.query('ALTER TABLE "agents" DROP COLUMN "operational_notes"');
    await queryRunner.query('ALTER TABLE "agents" DROP COLUMN "equipment_id"');
    await queryRunner.query('ALTER TABLE "agents" DROP COLUMN "operational_base_id"');
    await queryRunner.query('DROP TABLE "operational_bases"');
  }
}
