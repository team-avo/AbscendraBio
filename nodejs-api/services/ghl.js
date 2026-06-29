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
 *
 * Fully OPTIONAL and NON-BLOCKING. If GHL_API_TOKEN is not set every function is
 * a no-op. All network errors are caught and logged so this can never break
 * signup or checkout.
 *
 * Env:
 *   GHL_API_TOKEN     Private Integration token (pit-...). Required to enable.
 *   GHL_LOCATION_ID   Sub-account id (defaults to the Ascendra Bio location).
 *   GHL_PIPELINE_NAME Pipeline to use (default "B2B Sales Pipeline").
 *   GHL_STAGE_ACCOUNT Stage for new accounts (default "Won - Active Account").
 *   GHL_STAGE_ORDER   Stage for orders (default "Ordered").
 */
const logger = require("../utils/logger");

const BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const TOKEN = process.env.GHL_API_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID || "DJFXMlUOKfCCuRpu9aGF";
const PIPELINE_NAME = process.env.GHL_PIPELINE_NAME || "B2B Sales Pipeline";
const STAGE_ACCOUNT = process.env.GHL_STAGE_ACCOUNT || "Won - Active Account";
const STAGE_ORDER = process.env.GHL_STAGE_ORDER || "Ordered";

const ghlEnabled = () => Boolean(TOKEN);

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Version: API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function ghlFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
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

// Resolve pipeline + stage ids by name once, then cache for the process lifetime.
let pipelineCache;
async function resolvePipeline() {
  if (pipelineCache) return pipelineCache;
  const data = await ghlFetch(
    `/opportunities/pipelines?locationId=${encodeURIComponent(LOCATION_ID)}`,
  );
  const pipelines = data.pipelines || [];
  const pipeline =
    pipelines.find((p) => p.name === PIPELINE_NAME) || pipelines[0];
  if (!pipeline) throw new Error("No pipelines found in GHL location");
  const stageId = (name) => {
    const s = (pipeline.stages || []).find((st) => st.name === name);
    return s ? s.id : null;
  };
  pipelineCache = {
    pipelineId: pipeline.id,
    stages: { account: stageId(STAGE_ACCOUNT), order: stageId(STAGE_ORDER) },
  };
  return pipelineCache;
}

function cleanPhone(mobile) {
  const v = mobile && String(mobile).trim();
  return v || undefined;
}

// Upsert a contact by email; returns its contact id.
async function upsertContact({ email, firstName, lastName, phone, tags }) {
  const payload = {
    locationId: LOCATION_ID,
    email,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
    phone: cleanPhone(phone),
    tags: tags && tags.length ? tags : undefined,
  };
  const data = await ghlFetch("/contacts/upsert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.contact?.id || data.id;
}

// Create/update the contact's opportunity in a given stage.
async function upsertOpportunity({ contactId, stageId, name, monetaryValue }) {
  if (!contactId) return;
  const pc = await resolvePipeline();
  if (!stageId) {
    logger.warn("[ghl] stage id not found; skipping opportunity move");
    return;
  }
  const payload = {
    locationId: LOCATION_ID,
    pipelineId: pc.pipelineId,
    pipelineStageId: stageId,
    contactId,
    name: name || undefined,
    status: "open",
    monetaryValue: monetaryValue != null ? Number(monetaryValue) : undefined,
  };
  await ghlFetch("/opportunities/upsert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Customer created an account on the website.
 * @param {{email:string, firstName?:string, lastName?:string, mobile?:string}} customer
 */
async function syncAccountCreated(customer) {
  if (!ghlEnabled() || !customer?.email) return;
  try {
    const contactId = await upsertContact({
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.mobile,
      tags: ["account created"],
    });
    const pc = await resolvePipeline();
    await upsertOpportunity({
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
 * @param {{orderNumber?:string, totalAmount?:number, total?:number}} order
 * @param {{email:string, firstName?:string, lastName?:string, mobile?:string}} customer
 */
async function syncOrderPlaced(order, customer) {
  if (!ghlEnabled() || !customer?.email) return;
  try {
    const value = Number(order?.totalAmount ?? order?.total ?? 0) || undefined;
    const contactId = await upsertContact({
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.mobile,
      tags: ["ordered"],
    });
    const pc = await resolvePipeline();
    await upsertOpportunity({
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

module.exports = { syncAccountCreated, syncOrderPlaced, ghlEnabled };
