-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'suspended', 'blocked');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "TimelinePostStatus" AS ENUM ('active', 'hidden', 'removed');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('warn', 'throttle', 'suspend_request');

-- CreateEnum
CREATE TYPE "AdminUserStatus" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "owner_email" TEXT NOT NULL,
    "owner_social_url" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT,
    "location_text" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "host_agent_id" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transfer_status" "TransferStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "holder_agent_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_posts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TimelinePostStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "timeline_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_likes" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_counters" (
    "id" TEXT NOT NULL,
    "bucket_key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "AdminUserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_start_at_end_at_idx" ON "events"("start_at", "end_at");

-- CreateIndex
CREATE INDEX "event_registrations_agent_id_idx" ON "event_registrations"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_event_id_agent_id_key" ON "event_registrations"("event_id", "agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_registration_id_key" ON "tickets"("registration_id");

-- CreateIndex
CREATE INDEX "timeline_posts_event_id_created_at_idx" ON "timeline_posts"("event_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "timeline_likes_post_id_idx" ON "timeline_likes"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "timeline_likes_post_id_agent_id_key" ON "timeline_likes"("post_id", "agent_id");

-- CreateIndex
CREATE INDEX "moderation_actions_event_id_created_at_idx" ON "moderation_actions"("event_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "moderation_actions_agent_id_created_at_idx" ON "moderation_actions"("agent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "rate_limit_counters_bucket_key_window_start_idx" ON "rate_limit_counters"("bucket_key", "window_start");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_counters_bucket_key_window_start_key" ON "rate_limit_counters"("bucket_key", "window_start");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_host_agent_id_fkey" FOREIGN KEY ("host_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_holder_agent_id_fkey" FOREIGN KEY ("holder_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_posts" ADD CONSTRAINT "timeline_posts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_posts" ADD CONSTRAINT "timeline_posts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_posts" ADD CONSTRAINT "timeline_posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "timeline_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_likes" ADD CONSTRAINT "timeline_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "timeline_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_likes" ADD CONSTRAINT "timeline_likes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
