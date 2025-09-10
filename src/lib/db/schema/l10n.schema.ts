import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const service = pgTable("service", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  owners: text("owners").array().notNull().default(["admin@local"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const namespace = pgTable("namespace", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").references(() => service.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const l10nKey = pgTable("l10n_key", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").references(() => service.id, { onDelete: "set null" }),
  namespaceId: text("namespace_id").references(() => namespace.id, {
    onDelete: "set null",
  }),
  keyName: text("key_name").notNull(),
  tags: text("tags").array().notNull().default([]),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const translation = pgTable("translation", {
  id: text("id").primaryKey(),
  keyId: text("key_id")
    .notNull()
    .references(() => l10nKey.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  value: text("value"),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  checksum: text("checksum"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const releaseBundle = pgTable("release_bundle", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => service.id, { onDelete: "cascade" }),
  locales: text("locales").array().notNull().default([]),
  snapshotRef: text("snapshot_ref"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const event = pgTable("event", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
