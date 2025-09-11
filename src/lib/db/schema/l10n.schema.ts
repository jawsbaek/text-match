import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Enums for statuses and locales
export const statusEnum = pgEnum("status", ["draft", "active", "archived"]);
export const localeEnum = pgEnum("locale", [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ru",
  "ja",
  "ko",
  "zh",
  "ar",
  "hi",
]);

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
  status: statusEnum("status").notNull().default("draft"),
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
  locale: localeEnum("locale").notNull(),
  value: text("value"),
  status: statusEnum("status").notNull().default("draft"),
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

export const event = pgTable(
  "event",
  {
    id: text("id").primaryKey(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("event_entity_type_idx").on(table.entityType),
    index("event_entity_id_idx").on(table.entityId),
    index("event_created_at_idx").on(table.createdAt),
  ],
);

// Relations
export const serviceRelations = relations(service, ({ many }) => ({
  namespaces: many(namespace),
  keys: many(l10nKey),
  releaseBundles: many(releaseBundle),
}));

export const namespaceRelations = relations(namespace, ({ one, many }) => ({
  service: one(service, {
    fields: [namespace.serviceId],
    references: [service.id],
  }),
  keys: many(l10nKey),
}));

export const l10nKeyRelations = relations(l10nKey, ({ one, many }) => ({
  service: one(service, {
    fields: [l10nKey.serviceId],
    references: [service.id],
  }),
  namespace: one(namespace, {
    fields: [l10nKey.namespaceId],
    references: [namespace.id],
  }),
  translations: many(translation),
}));

export const translationRelations = relations(translation, ({ one }) => ({
  key: one(l10nKey, {
    fields: [translation.keyId],
    references: [l10nKey.id],
  }),
}));

export const releaseBundleRelations = relations(releaseBundle, ({ one }) => ({
  service: one(service, {
    fields: [releaseBundle.serviceId],
    references: [service.id],
  }),
}));
