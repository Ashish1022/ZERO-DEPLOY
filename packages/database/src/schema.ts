import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  boolean,
  jsonb,
  unique,
  foreignKey,
  pgEnum,
} from "drizzle-orm/pg-core";

export const enumDeploymentStatus = pgEnum("enum_deployment_status", ['NOT_STARTED', 'QUEUED', 'IN_PROGRESS', 'READY', 'FAILED'])
export const enumDomainStatus = pgEnum("enum_domain_status", ['PENDING', 'ACTIVE', 'FAILED'])

export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),

    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),

    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    phone: varchar("phone", { length: 20 }).notNull(),

    emailVerified: boolean("email_verified").default(false).notNull(),
    emailVerificationToken: varchar("email_verification_token", {
      length: 255,
    }),
    emailVerificationExpires: timestamp("email_verification_expires", {
      withTimezone: true,
    }),

    resetPasswordToken: varchar("reset_password_token", { length: 255 }),
    resetPasswordExpiration: timestamp("reset_password_expiration", {
      withTimezone: true,
    }),

    loginAttempts: integer("login_attempts").default(0).notNull(),
    lockUntil: timestamp("lock_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_active_idx")
      .on(t.email)
      .where(sql`${t.deletedAt} IS NULL`),

    phoneIdx: uniqueIndex("users_phone_active_idx")
      .on(t.phone)
      .where(sql`${t.deletedAt} IS NULL`),

    resetTokenIdx: index("users_reset_token_idx").on(t.resetPasswordToken),
  })
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid().defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),

    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    device: varchar("device", { length: 50 }),
    browser: varchar("browser", { length: 50 }),
    os: varchar("os", { length: 50 }),

    location: varchar("location", { length: 255 }),

    expiresAt: timestamp("expires_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("user_sessions_user_idx").on(t.userId),
    createdIdx: index("user_sessions_created_idx").on(t.createdAt),
  })
);

export const userEvents = pgTable(
  "user_events",
  {
    id: uuid().defaultRandom().primaryKey(),

    userId: uuid("user_id").references(() => users.id),

    anonymousId: varchar("anonymous_id", { length: 255 }),

    event: varchar("event", { length: 100 }).notNull(),

    metadata: jsonb("metadata"),

    ipAddress: varchar("ip_address", { length: 45 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("user_events_user_idx").on(t.userId),
    eventIdx: index("user_events_event_idx").on(t.event),
    createdIdx: index("user_events_created_idx").on(t.createdAt),
  })
);

export const pageViews = pgTable(
  "page_views",
  {
    id: uuid().defaultRandom().primaryKey(),

    userId: uuid("user_id").references(() => users.id),

    sessionId: uuid("session_id").references(() => userSessions.id),

    path: varchar("path", { length: 500 }).notNull(),

    referrer: varchar("referrer", { length: 500 }),

    duration: integer("duration"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("page_views_user_idx").on(t.userId),
    sessionIdx: index("page_views_session_idx").on(t.sessionId),
    pathIdx: index("page_views_path_idx").on(t.path),
    createdIdx: index("page_views_created_idx").on(t.createdAt),
  })
);

export const userDevices = pgTable(
  "user_devices",
  {
    id: uuid().defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),

    deviceId: varchar("device_id", { length: 255 }).notNull(),

    deviceName: varchar("device_name", { length: 255 }),

    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    deviceUnique: uniqueIndex("user_device_unique").on(t.userId, t.deviceId),
  })
);

export const userAttribution = pgTable(
  "user_attribution",
  {
    id: uuid().defaultRandom().primaryKey(),

    userId: uuid("user_id").references(() => users.id),

    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),

    referrer: varchar("referrer", { length: 500 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userUnique: uniqueIndex("user_attribution_user_unique").on(t.userId),
  })
);

export const project = pgTable('project', {
  id: uuid().defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  name: varchar().notNull(),
  gitUrl: varchar("git_url").notNull(),
  subdomain: varchar().notNull(),

  framework: varchar({ length: 50 }),
  rootDir: varchar("root_dir", { length: 500 }).default('/'),
  buildCommand: varchar("build_command", { length: 500 }),
  outputDir: varchar("output_dir", { length: 500 }),
  installCommand: varchar("install_command", { length: 500 }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("project_userId_idx").using("btree", table.userId.asc().nullsLast()),
  index("project_gitUrl_idx").using("btree", table.gitUrl.asc().nullsLast().op("text_ops")),
  index("project_subdomain_idx").using("btree", table.subdomain.asc().nullsLast().op("text_ops")),
  unique("project_subdomain_unique").on(table.subdomain),
]);

export const envVar = pgTable('env_var', {
  id: uuid().defaultRandom().primaryKey(),

  projectId: uuid("project_id")
    .references(() => project.id, { onDelete: 'cascade' })
    .notNull(),

  key: varchar({ length: 255 }).notNull(),
  value: text().notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("env_var_projectId_idx").using("btree", table.projectId.asc().nullsLast()),
  unique("env_var_project_key_unique").on(table.projectId, table.key),
]);

export const domain = pgTable('domain', {
  id: uuid().defaultRandom().primaryKey(),

  projectId: uuid("project_id")
    .references(() => project.id, { onDelete: 'cascade' })
    .notNull(),

  hostname: varchar({ length: 253 }).notNull(),
  status: enumDomainStatus().default('PENDING').notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("domain_projectId_idx").using("btree", table.projectId.asc().nullsLast()),
  unique("domain_hostname_unique").on(table.hostname),
]);

export const deployment = pgTable("deployment", {
  id: uuid().defaultRandom().primaryKey().notNull(),

  projectId: uuid("project_id"),
  status: enumDeploymentStatus(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("deployment_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
  index("project_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [project.id],
    name: "project_deployment_id_fk"
  }).onDelete("set null"),
]);