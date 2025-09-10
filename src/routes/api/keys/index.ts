import { createServerFileRoute } from "@tanstack/react-start/server";
import { and, eq, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/lib/db";
import { l10nKey, service as serviceTbl } from "~/lib/db/schema";

export const createKeySchema = z.object({
  id: z.string().min(1),
  keyName: z.string().min(1),
  serviceCode: z.string().min(1).optional(),
  namespaceId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Create a server route without middleware for now
export const ServerRoute = createServerFileRoute("/api/keys/").methods({
  GET: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const prefix = url.searchParams.get("prefix") || undefined;
    const serviceCode = url.searchParams.get("service") || undefined;

    const conds: SQL<unknown>[] = [];
    if (prefix) {
      conds.push(ilike(l10nKey.keyName, `${prefix}%`));
    }
    if (serviceCode) {
      // join service by code
      const svc = await db.query.service.findFirst({
        where: eq(serviceTbl.code, serviceCode),
      });
      if (svc) {
        conds.push(eq(l10nKey.serviceId, svc.id));
      }
    }

    const rows = conds.length
      ? await db
          .select()
          .from(l10nKey)
          .where(and(...conds))
          .limit(100)
      : await db.select().from(l10nKey).limit(100);
    return new Response(JSON.stringify({ items: rows }), {
      headers: { "content-type": "application/json" },
    });
  },
  POST: async ({ request }: { request: Request }) => {
    const body = await request.json().catch(() => ({}));
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: z.treeifyError(parsed.error) }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const { id, keyName, serviceCode, namespaceId, tags } = parsed.data;

    let serviceId: string | null = null;
    if (serviceCode) {
      const svc = await db.query.service.findFirst({
        where: eq(serviceTbl.code, serviceCode),
      });
      if (!svc) {
        return new Response(JSON.stringify({ error: "service not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      serviceId = svc.id;
    }

    await db.insert(l10nKey).values({
      id,
      keyName,
      serviceId,
      namespaceId: namespaceId ?? null,
      tags: tags ?? [],
    });
    return new Response(null, { status: 201 });
  },
});
