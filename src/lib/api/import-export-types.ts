import { z } from "zod";

export const supportedLocales = [
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
] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const translationStatusEnum = ["draft", "active", "archived"] as const;

export type TranslationStatus = (typeof translationStatusEnum)[number];

export const importPayloadSchema = z.object({
  dryRun: z.boolean().default(false),
  service: z.string().min(1),
  data: z.object({
    keys: z.array(
      z.object({
        id: z.string().min(1),
        keyName: z.string().min(1),
        namespaceId: z.string().optional(),
        tags: z.array(z.string()).default([]),
        status: z.enum(translationStatusEnum).default("draft"),
        translations: z
          .array(
            z.object({
              locale: z.enum(supportedLocales),
              value: z.string(),
              status: z.enum(translationStatusEnum).default("draft"),
              version: z.number().int().positive().default(1),
            }),
          )
          .default([]),
      }),
    ),
  }),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;

export interface ExportData {
  service: string;
  locales: string[];
  exportedAt: string;
  data: {
    keys: Array<{
      id: string;
      keyName: string;
      namespaceId?: string;
      tags: string[];
      status: string;
      translations: Array<{
        locale: string;
        value: string;
        status: string;
        version: number;
      }>;
    }>;
  };
}
