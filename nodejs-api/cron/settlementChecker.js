const prisma = require('../prisma/client');


async function fetchSettledBatches({ firstSettlementDate, lastSettlementDate }) {
  const apiLoginId = process.env.ANET_API_LOGIN_ID;
  const transactionKey = process.env.ANET_TRANSACTION_KEY;
  const endpoint = process.env.ANET_ENV === 'production'
    ? 'https://api.authorize.net/xml/v1/request.api'
    : 'https://apitest.authorize.net/xml/v1/request.api';

  if (!apiLoginId || !transactionKey) {
    throw new Error('Authorize.Net credentials are not configured');
  }

  const payload = {
    getSettledBatchListRequest: {
      merchantAuthentication: { name: apiLoginId, transactionKey },
      firstSettlementDate,
      lastSettlementDate,
      includeStatistics: true
    }
  };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (data?.messages?.resultCode !== 'Ok') {
    const err = data?.messages?.message?.[0]?.text || 'Failed to fetch settled batches';
    throw new Error(err);
  }
  return data.batchList || [];
}

async function run() {
  // Default last 24 hours
  const to = new Date();
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const firstSettlementDate = from.toISOString();
  const lastSettlementDate = to.toISOString();

  const batches = await fetchSettledBatches({ firstSettlementDate, lastSettlementDate });

  const settled = new Set();
  for (const b of batches) {
    if (b.settlementState === 'settledSuccessfully') {
      settled.add(b.batchId);
    }
  }

  if (settled.size === 0) return { updated: 0 };

  // Update any transactions/payments that belong to settled batches.
  // We don't store batchId, so as a pragmatic approach: mark pending Authorize.Net transactions older than 24h as COMPLETED if gateway said Ok earlier.
  const pendingTxs = await prisma.transaction.findMany({
    where: { paymentStatus: 'PENDING', paymentGatewayName: 'AUTHORIZE_NET' },
  });

  let updated = 0;
  for (const tx of pendingTxs) {
    // Promote to COMPLETED and corresponding payment if exists
    await prisma.$transaction(async (px) => {
      await px.transaction.update({ where: { id: tx.id }, data: { paymentStatus: 'COMPLETED' } });
      const payment = await px.payment.findFirst({ where: { orderId: tx.orderId } });
      if (payment && payment.status !== 'COMPLETED') {
        await px.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED', paidAt: new Date() } });
      }
      updated += 1;
    });
  }

  return { updated };
}

module.exports = { run };


