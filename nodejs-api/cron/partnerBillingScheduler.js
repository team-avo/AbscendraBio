const prisma = require('../prisma/client');
const { queueEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * Helper to get store information for email templates
 */
const getStoreEmailData = async () => {
    try {
        const storeInfo = await prisma.storeInformation.findFirst();
        if (!storeInfo) return {};

        return {
            storeName: storeInfo.name,
            storeEmail: storeInfo.email,
            storePhone: storeInfo.phone,
            storeAddress: `${storeInfo.addressLine1}${storeInfo.addressLine2 ? ', ' + storeInfo.addressLine2 : ''}, ${storeInfo.city}, ${storeInfo.state} ${storeInfo.postalCode}`,
            storeWebsite: process.env.STORE_WEBSITE || 'https://ascendrabio.com'
        };
    } catch (err) {
        logger.error('[PartnerBillingCron] Error fetching store info', err);
        return {};
    }
};

/**
 * Core logic for checking triggers and generating statements
 * @param {string} channelId - Optional channel ID for manual triggers
 */
const generatePartnerStatements = async (channelId = null) => {
    const whereClause = channelId
        ? { id: channelId }
        : { status: 'ACTIVE', type: 'PARTNER' };

    const channels = await prisma.salesChannel.findMany({
        where: whereClause,
        include: { statementConfig: true },
    });

    const results = { triggered: 0, errors: 0 };
    const storeEmailData = await getStoreEmailData();

    for (const channel of channels) {
        try {
            const config = channel.statementConfig;
            if (!config) continue;

            // Fetch unbilled ledger entries
            const unbilledEntries = await prisma.partnerLedgerEntry.findMany({
                where: {
                    salesChannelId: channel.id,
                    statementId: null,
                },
            });

            if (unbilledEntries.length === 0) continue;

            const unbilledOrderCount = unbilledEntries.filter(e => e.type === 'RECEIVABLE').length;
            const currentUnbilledTotal = unbilledEntries.reduce((sum, e) => {
                // Receivables increase balance, Payments decrease it
                return e.type === 'RECEIVABLE' ? sum + Number(e.amount) : sum - Number(e.amount);
            }, 0);

            // Check for last statement date
            const lastStatement = await prisma.partnerStatement.findFirst({
                where: { salesChannelId: channel.id },
                orderBy: { createdAt: 'desc' },
            });

            let shouldTrigger = !!channelId; // Bypass thresholds if manually triggered for a specific channel
            let triggerReason = channelId ? 'Manual trigger' : '';

            // Trigger Check 1: Billing Cycle
            const daysSinceLastStatement = lastStatement
                ? Math.floor((new Date() - new Date(lastStatement.createdAt)) / (1000 * 60 * 60 * 24))
                : Math.floor((new Date() - new Date(channel.createdAt)) / (1000 * 60 * 60 * 24));

            if (daysSinceLastStatement >= config.billingCycleDays) {
                shouldTrigger = true;
                triggerReason = `${daysSinceLastStatement} days since last statement`;
            }

            // Trigger Check 2: Balance Threshold
            if (config.balanceThreshold && currentUnbilledTotal >= Number(config.balanceThreshold)) {
                shouldTrigger = true;
                triggerReason = `Unbilled balance $${currentUnbilledTotal} exceeds threshold $${config.balanceThreshold}`;
            }

            // Trigger Check 3: Order Count Threshold
            if (config.orderCountThreshold && unbilledOrderCount >= config.orderCountThreshold) {
                shouldTrigger = true;
                triggerReason = `Unbilled order count ${unbilledOrderCount} exceeds threshold ${config.orderCountThreshold}`;
            }

            if (shouldTrigger && currentUnbilledTotal > 0) {
                logger.info(`[PartnerBillingCron] Triggering statement for ${channel.companyName}`, { triggerReason });
                await createStatement(channel, unbilledEntries, config, storeEmailData);
                results.triggered++;
            }
        } catch (err) {
            logger.error(`[PartnerBillingCron] Error processing channel ${channel.id}`, err);
            results.errors++;
        }
    }
    return results;
};

/**
 * Create a new statement and send email
 */
const createStatement = async (channel, entries, config, storeEmailData = {}) => {
    const totalAmount = entries.reduce((sum, e) => {
        return e.type === 'RECEIVABLE' ? sum + Number(e.amount) : sum - Number(e.amount);
    }, 0);

    const referenceId = `STMT-${channel.id.substring(0, 4)}-${Date.now()}`;
    const dueDate = new Date();
    // Use billingCycleDays for the due date (Net X)
    const netDays = config.billingCycleDays || 14;
    dueDate.setDate(dueDate.getDate() + netDays);

    await prisma.$transaction(async (tx) => {
        // 1. Create Statement
        const statement = await tx.partnerStatement.create({
            data: {
                referenceId,
                salesChannelId: channel.id,
                totalAmount,
                dueDate,
                status: 'SENT',
            },
        });

        // 2. Link Ledger Entries
        await tx.partnerLedgerEntry.updateMany({
            where: { id: { in: entries.map(e => e.id) } },
            data: { statementId: statement.id },
        });

        // 3. Queue Email: Only if there is an amount to pay
        if (totalAmount > 0) {
            await queueEmail({
                type: 'TEMPLATE',
                templateType: 'PARTNER_STATEMENT_GENERATED',
                recipientEmail: channel.contactEmail || 'billing@placeholder.com',
                data: {
                    companyName: channel.companyName,
                    statementId: referenceId,
                    totalAmount: totalAmount.toFixed(2),
                    dueDate: dueDate.toLocaleDateString(),
                    paymentInstructions: config.paymentInstructions || 'Please pay via Bank Transfer.',
                    ...storeEmailData
                },
            });
        }
    });
};

/**
 * Core logic for sending reminders
 */
const sendPaymentReminders = async () => {
    const openStatements = await prisma.partnerStatement.findMany({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        include: { salesChannel: { include: { statementConfig: true } } },
    });

    const results = { remindersSent: 0, escalationsSent: 0, errors: 0 };
    const storeEmailData = await getStoreEmailData();

    for (const statement of openStatements) {
        try {
            const config = statement.salesChannel.statementConfig;
            if (!config) continue;

            const now = new Date();
            const daysSinceGenerated = Math.floor((now - new Date(statement.createdAt)) / (1000 * 60 * 60 * 24));
            const isOverdue = now > new Date(statement.dueDate);
            const amountDue = Number(statement.totalAmount) - Number(statement.paidAmount);

            // STOP: If amount is settled, do not send any reminders
            if (amountDue <= 0) {
                if (statement.status !== 'PAID') {
                    await prisma.partnerStatement.update({
                        where: { id: statement.id },
                        data: { status: 'PAID' }
                    });
                }
                continue;
            }

            // Redundancy Check: Only send one email per 24h
            const lastReminderAt = statement.lastReminderAt ? new Date(statement.lastReminderAt) : null;
            const hoursSinceLastReminder = lastReminderAt ? (now - lastReminderAt) / (1000 * 60 * 60) : 999;

            if (hoursSinceLastReminder < 20) {
                // Skip if sent recently (using 20h to allow for daily cron variations)
                continue;
            }

            let templateType = null;
            let updateData = {};

            // Dynamic Logic based on Billing Cycle
            const billingCycle = config.billingCycleDays || 14;
            const dueSoonDay = Math.floor(billingCycle / 2); // e.g. Day 7 for 14-day cycle
            const dueTodayDay = billingCycle; // e.g. Day 14 for 14-day cycle

            if (daysSinceGenerated === dueSoonDay && statement.status !== 'PAID') {
                templateType = 'PARTNER_PAYMENT_REMINDER'; // Day 7 (Due Soon)
            } else if (daysSinceGenerated === dueTodayDay && statement.status !== 'PAID') {
                templateType = 'PARTNER_PAYMENT_REMINDER'; // Day 14 (Due Today)
            } else if (isOverdue && statement.status !== 'PAID') {
                templateType = 'PARTNER_OVERDUE_ALERT'; // Overdue Reminder
                if (statement.status !== 'OVERDUE') {
                    updateData.status = 'OVERDUE';
                }
            }

            // Escalation Logics
            if (isOverdue) {
                const daysOverdue = Math.floor((new Date() - new Date(statement.dueDate)) / (1000 * 60 * 60 * 24));
                if (daysOverdue >= config.escalationDays) {
                    // Internal Escalation
                    await queueEmail({
                        type: 'RAW',
                        to: process.env.FINANCE_EMAIL || 'finance@ascendrabio.com',
                        subject: `ESCALATION: Statement ${statement.referenceId} is ${daysOverdue} days overdue`,
                        html: `<p>Statement ${statement.referenceId} for ${statement.salesChannel.companyName} is ${daysOverdue} days overdue.</p>
                   <p>Total Amount: $${statement.totalAmount}</p>
                   <p>Remaining: $${(Number(statement.totalAmount) - Number(statement.paidAmount)).toFixed(2)}</p>`,
                    });
                    results.escalationsSent++;
                }
            }

            if (templateType && amountDue > 0) {
                await queueEmail({
                    type: 'TEMPLATE',
                    templateType,
                    recipientEmail: statement.salesChannel.contactEmail || 'billing@placeholder.com',
                    data: {
                        companyName: statement.salesChannel.companyName,
                        statementId: statement.referenceId,
                        totalAmount: amountDue.toFixed(2),
                        dueDate: statement.dueDate.toLocaleDateString(),
                        ...storeEmailData
                    }
                });

                await prisma.partnerStatement.update({
                    where: { id: statement.id },
                    data: {
                        ...updateData,
                        remindersSent: { increment: 1 },
                        lastReminderAt: new Date(),
                    }
                });
                results.remindersSent++;
            }
        } catch (err) {
            logger.error(`[PartnerBillingCron] Error processing statement ${statement.id}`, err);
            results.errors++;
        }
    }
    return results;
};

module.exports = { generatePartnerStatements, sendPaymentReminders };
