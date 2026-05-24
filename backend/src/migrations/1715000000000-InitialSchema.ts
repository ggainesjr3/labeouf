import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1715000000000 implements MigrationInterface {
  name = 'InitialSchema1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "username" varchar(32) NOT NULL,
        "passwordHash" varchar,
        "googleId" varchar,
        "displayName" varchar(100),
        "bio" text,
        "avatarUrl" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_googleId" UNIQUE ("googleId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "posts" (
        "id" SERIAL PRIMARY KEY,
        "text" text NOT NULL,
        "imageUrl" varchar(2048),
        "authorId" integer NOT NULL,
        "likeCount" integer NOT NULL DEFAULT 0,
        "repostCount" integer NOT NULL DEFAULT 0,
        "auditMetadata" jsonb NOT NULL DEFAULT '{}',
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_posts_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audits" (
        "id" SERIAL PRIMARY KEY,
        "text" text NOT NULL,
        "label" varchar(64) NOT NULL,
        "confidence" double precision NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "timestamp" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "likes" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "postId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_likes_user_post" UNIQUE ("userId", "postId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "follows" (
        "id" SERIAL PRIMARY KEY,
        "followerId" integer NOT NULL,
        "followingId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_follows_follower_following" UNIQUE ("followerId", "followingId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "replies" (
        "id" SERIAL PRIMARY KEY,
        "text" text NOT NULL,
        "authorId" integer NOT NULL,
        "postId" integer NOT NULL,
        "auditMetadata" jsonb NOT NULL DEFAULT '{}',
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_replies_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_replies_post" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reposts" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "postId" integer NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_reposts_user_post" UNIQUE ("userId", "postId"),
        CONSTRAINT "FK_reposts_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reposts_post" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" SERIAL PRIMARY KEY,
        "text" text NOT NULL,
        "senderId" integer NOT NULL,
        "recipientId" integer NOT NULL,
        "read" boolean NOT NULL DEFAULT false,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_recipient" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookmarks" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "postId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_bookmarks_user_post" UNIQUE ("userId", "postId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bookmarks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reposts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "replies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "follows"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "likes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "posts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
