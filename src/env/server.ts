import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().optional(),
    NETLIFY_DATABASE_URL: z.string().optional(),
    VITE_BASE_URL: z
      .string()
      .regex(/^https?:\/\/.+/)
      .default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(1),

    // OAuth2 providers, optional, update as needed
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Netlify Identity (GoTrue)
    NETLIFY_IDENTITY_SITE: z.string().optional(),
    NETLIFY_IDENTITY_AUD: z.string().optional(),
  },
  runtimeEnv: process.env,
});
