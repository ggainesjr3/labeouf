import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModerationAndMediaSchema1716000000000 implements MigrationInterface {
  name = 'AddModerationAndMediaSchema1716000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role" varchar(20) NOT NULL DEFAULT 'user'
    `);

    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN IF NOT EXISTS "videoUrl" varchar(2048)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer,
        "contentType" varchar(16) NOT NULL,
        "contentId" varchar(64) NOT NULL,
        "reason" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_reports_user_content" UNIQUE ("userId", "contentType", "contentId"),
        CONSTRAINT "FK_reports_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reports_userId" ON "reports" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reports_contentId" ON "reports" ("contentId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reports_status" ON "reports" ("status")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "moderation_logs" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer,
        "contentType" varchar(16) NOT NULL,
        "contentId" varchar(36) NOT NULL,
        "decision" varchar(20) NOT NULL,
        "reason" varchar(512) NOT NULL,
        "detectionMethod" varchar(64) NOT NULL,
        "confidence" double precision,
        "rawResult" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_moderation_logs_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_moderation_logs_content_created"
      ON "moderation_logs" ("contentId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_moderation_logs_decision_created"
      ON "moderation_logs" ("decision", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_moderation_logs_decision_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_moderation_logs_content_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "moderation_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_contentId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "videoUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
  }
}
