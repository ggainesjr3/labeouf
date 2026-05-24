import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEmail1716200000000 implements MigrationInterface {
  name = 'AddUserEmail1716200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email" varchar
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email"
      ON "users" ("email")
      WHERE "email" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`);
  }
}
