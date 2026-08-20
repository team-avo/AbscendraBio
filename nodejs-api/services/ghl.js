/**
 * GoHighLevel (LeadConnector) sync.
 *
 * Closes the website -> GHL loop so the sales pipeline reflects real
 * conversions instead of only catalog clicks:
 *
 *   syncAccountCreated(customer)     -> upsert contact, tag "account created",
 *                                       move opportunity to "Won - Active Account"
 *   syncOrderPlaced(order, customer) -> upsert contact, tag "ordered",
 *                                       move opportunity to "Ordered" + order value
 *   syncAbandonedCart(contact)       -> upsert contact, tag "abandoned cart"
 *                                       (drives a GHL abandoned-cart workflow)
 *
 * Brand-aware routing. Each storefront can sync into its own GHL sub-account:
 * a Lineará signup/order (brand === "lineara") uses the Lineará token +
 * location + pipeline when the *_LINEARA envs are set, otherwise it falls back
 * to the base (Ascendra) token + location. So this is safe to ship dormant —
 * behaviour is identical to a single-account setup until GHL_API_TOKEN_LINEARA
 * and GHL_LOCATION_ID_LINEARA are provisioned. Every contact still carries a
 * brand:<storefront> tag as a backstop segmentation signal.
 *
 * Fully OPTIONAL and NON-BLOCKING. If the relevant token is not set every
 * function is a no-op. All network errors are caught and logged so this can
 * never break signup or checkout.
 *
 * Env (base / Ascendra):
 *   GHL_API_TOKEN            Private Integration token (pit-...). Required to enable.
 *   GHL_LOCATION_ID          Sub-account id (defaults to the Ascendra Bio location).
 *   GHL_PIPELINE_NAME        Pipeline to use (default "B2B Sales Pipeline").
 *   GHL_STAGE_ACCOUNT        Stage for new accounts (default "Won - Active Account").
 *   GHL_STAGE_ORDER          Stage for orders (default "Ordered").
 * Env (Lineará overrides — each falls back to the base value when unset):
 *   GHL_API_TOKEN_LINEARA    Private Integration token minted INSIDE the Lineará sub-account.
 *   GHL_LOCATION_ID_LINEARA  Lineará sub-account id.
 *   GHL_PIPELINE_NAME_LINEARA / GHL_STAGE_ACCOUNT_LINEARA / GHL_STAGE_ORDER_LINEARA
 */
const logger = require("../utils/logger");

const BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const DEFAULT_LOCATION_ID = "DJFXMlUOKfCCuRpu9aGF";
const DEFAULT_PIPELINE_NAME = "B2B Sales Pipeline";
const DEFAULT_STAGE_ACCOUNT = "Won - Active Account";
const DEFAULT_STAGE_ORDER = "Ordered";

// Resolve the GHL routing config for a given storefront brand. Lineará values
// fall back to the base (Ascendra) config until the Lineará sub-account is
// provisioned, so setting the *_LINEARA envs is a zero-code cutover.
function brandGhl(brand) {
  const isLineara = brand === "lineara";
  const pick = (linearaVal, baseVal) =>
    (isLineara && linearaVal) || baseVal;
  return {
    isLineara,
    token: pick(process.env.GHL_API_TOKEN_LINEARA, process.env.GHL_API_TOKEN),
    locationId: pick(
      process.env.GHL_LOCATION_ID_LINEARA,
      process.env.GHL_LOCATION_ID || DEFAULT_LOCATION_ID,
    ),
    pipelineName: pick(
      process.env.GHL_PIPELINE_NAME_LINEARA,
      process.env.GHL_PIPELINE_NAME || DEFAULT_PIPELINE_NAME,
    ),
    stageAccount: pick(
      process.env.GHL_STAGE_ACCOUNT_LINEARA,
      process.env.GHL_STAGE_ACCOUNT || DEFAULT_STAGE_ACCOUNT,
    ),
    stageOrder: pick(
      process.env.GHL_STAGE_ORDER_LINEARA,
      process.env.GHL_STAGE_ORDER || DEFAULT_STAGE_ORDER,
    ),
  };
}

// Base enablement check (kept for backwards-compatible external callers).
const ghlEnabled = () => Boolean(process.env.GHL_API_TOKEN);

function headers(cfg) {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Version: API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function ghlFetch(cfg, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(cfg), ...(options.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      `GHL ${options.method || "GET"} ${path} -> ${res.status}: ${String(text).slice(0, 300)}`,
    );
    err.status = res.status;
    throw err;
  }
  return body;
}

// Resolve pipeline + stage ids by name once per (location, pipeline), then cache
// for the process lifetime. Keyed so each sub-account resolves independently.
const pipelineCache = new Map();
async function resolvePipeline(cfg) {
  const key = `${cfg.locationId}::${cfg.pipelineName}`;
  if (pipelineCache.has(key)) return pipelineCache.get(key);
  const data = await ghlFetch(
    cfg,
    `/opportunities/pipelines?locationId=${encodeURIComponent(cfg.locationId)}`,
  );
  const pipelines = data.pipelines || [];
  const pipeline =
    pipelines.find((p) => p.name === cfg.pipelineName) || pipelines[0];
  if (!pipeline) throw new Error("No pipelines found in GHL location");
  const stageId = (name) => {
    const s = (pipeline.stages || []).find((st) => st.name === name);
    return s ? s.id : null;
  };
  const resolved = {
    pipelineId: pipeline.id,
    stages: {
      account: stageId(cfg.stageAccount),
      order: stageId(cfg.stageOrder),
    },
  };
  pipelineCache.set(key, resolved);
  return resolved;
}

function cleanPhone(mobile) {
  const v = mobile && String(mobile).trim();
  return v || undefined;
}

// Brand segmentation tag so GHL sequences can target one storefront only.
// Lineará signups/orders carry brand === "lineara"; everything else is Ascendra.
function brandTag(brand) {
  return brand === "lineara" ? "brand:lineara" : "brand:ascendra";
}

// Upsert a contact by email; returns its contact id.
async function upsertContact(cfg, { email, firstName, lastName, phone, tags }) {
  const payload = {
    locationId: cfg.locationId,
    email,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
    phone: cleanPhone(phone),
    tags: tags && tags.length ? tags : undefined,
  };
  const data = await ghlFetch(cfg, "/contacts/upsert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.contact?.id || data.id;
}

// Create/update the contact's opportunity in a given stage.
async function upsertOpportunity(cfg, { contactId, stageId, name, monetaryValue }) {
  if (!contactId) return;
  const pc = await resolvePipeline(cfg);
  if (!stageId) {
    logger.warn("[ghl] stage id not found; skipping opportunity move");
    return;
  }
  const payload = {
    locationId: cfg.locationId,
    pipelineId: pc.pipelineId,
    pipelineStageId: stageId,
    contactId,
    name: name || undefined,
    status: "open",
    monetaryValue: monetaryValue != null ? Number(monetaryValue) : undefined,
  };
  await ghlFetch(cfg, "/opportunities/upsert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Customer created an account on the website.
 * @param {{email:string, firstName?:string, lastName?:string, mobile?:string, brand?:string}} customer
 */
async function syncAccountCreated(customer) {
  const cfg = brandGhl(customer?.brand);
  if (!cfg.token || !customer?.email) return;
  try {
    const contactId = await upsertContact(cfg, {
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.mobile,
      tags: ["account created", brandTag(customer.brand)],
    });
    const pc = await resolvePipeline(cfg);
    await upsertOpportunity(cfg, {
      contactId,
      stageId: pc.stages.account,
      name:
        [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
        customer.email,
    });
    logger.info(`[ghl] synced account_created for ${customer.email}`);
  } catch (err) {
    logger.warn(
      `[ghl] account_created sync failed for ${customer?.email}: ${err.message}`,
    );
  }
}

/**
 * Customer placed an order on the website.
 * @param {{orderNumber?:string, totalAmount?:number, total?:number, brand?:string}} order
 * @param {{email:string, firstName?:string, lastName?:string, mobile?:string, brand?:string}} customer
 */
async function syncOrderPlaced(order, customer) {
  const brand = order?.brand ?? customer?.brand;
  const cfg = brandGhl(brand);
  if (!cfg.token || !customer?.email) return;
  try {
    const value = Number(order?.totalAmount ?? order?.total ?? 0) || undefined;
    const contactId = await upsertContact(cfg, {
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.mobile,
      tags: ["ordered", brandTag(brand)],
    });
    const pc = await resolvePipeline(cfg);
    await upsertOpportunity(cfg, {
      contactId,
      stageId: pc.stages.order,
      name: order?.orderNumber ? `Order ${order.orderNumber}` : customer.email,
      monetaryValue: value,
    });
    logger.info(
      `[ghl] synced order_placed (${order?.orderNumber || "?"}) for ${customer.email}`,
    );
  } catch (err) {
    logger.warn(
      `[ghl] order_placed sync failed for ${customer?.email}: ${err.message}`,
    );
  }
}

/**
 * Customer left items in an active cart without checking out. Tags the contact
 * "abandoned cart" so a GHL workflow can pick up the follow-up. Contact-only
 * (no opportunity move) so it never depends on a bespoke pipeline stage.
 * @param {{email:string, firstName?:string, lastName?:string, mobile?:string, brand?:string}} contact
 */
async function syncAbandonedCart(contact) {
  const cfg = brandGhl(contact?.brand);
  if (!cfg.token || !contact?.email) return;
  try {
    await upsertContact(cfg, {
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.mobile,
      tags: ["abandoned cart", brandTag(contact.brand)],
    });
    logger.info(`[ghl] synced abandoned_cart for ${contact.email}`);
  } catch (err) {
    logger.warn(
      `[ghl] abandoned_cart sync failed for ${contact?.email}: ${err.message}`,
    );
  }
}

module.exports = {
  syncAccountCreated,
  syncOrderPlaced,
  syncAbandonedCart,
  ghlEnabled,
};
