import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePredictiveIntelligence1793000000000 implements MigrationInterface {
  name = 'CreatePredictiveIntelligence1793000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "intelligence_datasets" (
        "dataset_key" varchar(80) PRIMARY KEY,
        "version" varchar(24) NOT NULL,
        "origin" varchar(16) NOT NULL,
        "anchor_at" timestamptz NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_intelligence_datasets_origin" CHECK ("origin" = 'synthetic'),
        CONSTRAINT "chk_intelligence_datasets_details_object" CHECK (jsonb_typeof("details") = 'object')
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "intelligence_history_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "dataset_key" varchar(80) NOT NULL,
        "event_key" varchar(180) NOT NULL,
        "equipment_id" uuid NOT NULL,
        "region_id" uuid NOT NULL,
        "event_type" varchar(32) NOT NULL,
        "severity" varchar(12),
        "occurred_at" timestamptz NOT NULL,
        "details" jsonb NOT NULL,
        "origin" varchar(16) NOT NULL DEFAULT 'synthetic',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_intelligence_history_event_key" UNIQUE ("event_key"),
        CONSTRAINT "fk_intelligence_history_dataset" FOREIGN KEY ("dataset_key") REFERENCES "intelligence_datasets"("dataset_key") ON DELETE CASCADE,
        CONSTRAINT "fk_intelligence_history_equipment" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_intelligence_history_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_intelligence_history_event_type" CHECK ("event_type" IN ('status_observation', 'failure', 'maintenance_due', 'maintenance_completed')),
        CONSTRAINT "chk_intelligence_history_severity" CHECK ("severity" IS NULL OR "severity" IN ('low', 'medium', 'high', 'critical')),
        CONSTRAINT "chk_intelligence_history_origin" CHECK ("origin" = 'synthetic'),
        CONSTRAINT "chk_intelligence_history_details_object" CHECK (jsonb_typeof("details") = 'object')
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_intelligence_history_region_date" ON "intelligence_history_events" ("region_id", "occurred_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "idx_intelligence_history_equipment_date" ON "intelligence_history_events" ("equipment_id", "occurred_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "idx_intelligence_history_dataset_type_date" ON "intelligence_history_events" ("dataset_key", "event_type", "occurred_at")`);

    await queryRunner.query(`
      CREATE TABLE "intelligence_assessments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assessment_key" varchar(180) NOT NULL,
        "source_scope" varchar(12) NOT NULL,
        "reference_at" timestamptz NOT NULL,
        "window_start" timestamptz NOT NULL,
        "horizon_hours" smallint NOT NULL DEFAULT 24,
        "method_version" varchar(32) NOT NULL,
        "source_composition" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_intelligence_assessments_key" UNIQUE ("assessment_key"),
        CONSTRAINT "chk_intelligence_assessments_scope" CHECK ("source_scope" IN ('demo', 'manual', 'all')),
        CONSTRAINT "chk_intelligence_assessments_horizon" CHECK ("horizon_hours" = 24),
        CONSTRAINT "chk_intelligence_assessments_window" CHECK ("window_start" < "reference_at"),
        CONSTRAINT "chk_intelligence_assessments_sources_object" CHECK (jsonb_typeof("source_composition") = 'object')
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_intelligence_assessments_scope_reference" ON "intelligence_assessments" ("source_scope", "reference_at" DESC)`);

    await queryRunner.query(`
      CREATE TABLE "intelligence_region_assessments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assessment_id" uuid NOT NULL,
        "region_id" uuid NOT NULL,
        "risk_score" smallint,
        "classification" varchar(24) NOT NULL,
        "data_quality" varchar(16) NOT NULL,
        "observation_count" integer NOT NULL DEFAULT 0,
        "failure_count" integer NOT NULL DEFAULT 0,
        "eligible_equipment_count" integer NOT NULL DEFAULT 0,
        "unavailable_equipment_count" integer NOT NULL DEFAULT 0,
        "coverage_days" smallint NOT NULL DEFAULT 0,
        "factors" jsonb NOT NULL,
        "recommendations" jsonb NOT NULL,
        CONSTRAINT "fk_intelligence_region_assessment_run" FOREIGN KEY ("assessment_id") REFERENCES "intelligence_assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_intelligence_region_assessment_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_intelligence_region_assessment" UNIQUE ("assessment_id", "region_id"),
        CONSTRAINT "chk_intelligence_region_assessment_score" CHECK ("risk_score" IS NULL OR "risk_score" BETWEEN 0 AND 100),
        CONSTRAINT "chk_intelligence_region_assessment_class" CHECK ("classification" IN ('low', 'moderate', 'elevated', 'critical', 'insufficient_data')),
        CONSTRAINT "chk_intelligence_region_assessment_quality" CHECK ("data_quality" IN ('sufficient', 'limited', 'insufficient')),
        CONSTRAINT "chk_intelligence_region_assessment_arrays" CHECK (jsonb_typeof("factors") = 'array' AND jsonb_typeof("recommendations") = 'array')
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_intelligence_region_assessment_region" ON "intelligence_region_assessments" ("region_id", "assessment_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "intelligence_region_assessments"');
    await queryRunner.query('DROP TABLE "intelligence_assessments"');
    await queryRunner.query('DROP TABLE "intelligence_history_events"');
    await queryRunner.query('DROP TABLE "intelligence_datasets"');
  }
}
