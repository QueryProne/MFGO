import { Router } from "express";

import {
  globalSearch,
  type GlobalSearchEntity,
} from "@workspace/db/utils/global-search";

const router = Router();

const PREFIX_MAP: Record<string, GlobalSearchEntity> = {
  so: "salesorder",
  po: "purchaseorder",
  wo: "workorder",
  item: "item",
  customer: "customer",
  vendor: "vendor",
  invoice: "invoice",
  lead: "lead",
  opportunity: "opportunity",
  form: "form",
  field: "custom-field",
  page: "page",
  value: "value",
};

const VALID_ENTITIES = new Set<GlobalSearchEntity>([
  "page",
  "form",
  "custom-field",
  "value",
  "customer",
  "vendor",
  "item",
  "salesorder",
  "purchaseorder",
  "workorder",
  "invoice",
  "lead",
  "opportunity",
]);

router.get("/search", async (req, res) => {
  try {
    const rawQuery = typeof req.query.q === "string" ? req.query.q : "";
    const parsedLimit = Number.parseInt(typeof req.query.limit === "string" ? req.query.limit : "", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 50)) : 20;

    if (!rawQuery.trim()) {
      res.json({ results: [], total: 0, query: rawQuery });
      return;
    }

    let searchTerm = rawQuery.trim();
    let entityFilter: GlobalSearchEntity | undefined;

    const syntaxMatch = rawQuery.match(/^([a-z_]+):(.+)$/i);
    if (syntaxMatch) {
      const [, prefixRaw, value] = syntaxMatch;
      const normalizedPrefix = prefixRaw.toLowerCase();
      const mapped = PREFIX_MAP[normalizedPrefix];
      if (mapped) {
        entityFilter = mapped;
        searchTerm = value.trim();
      }
    }

    if (!entityFilter && typeof req.query.entity === "string") {
      const candidate = req.query.entity.toLowerCase() as GlobalSearchEntity;
      if (VALID_ENTITIES.has(candidate)) {
        entityFilter = candidate;
      }
    }

    const results = await globalSearch(searchTerm, { limit, entityFilter });
    res.json({ results, total: results.length, query: rawQuery });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
