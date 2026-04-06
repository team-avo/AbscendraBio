/**
 * Utility to handle financial day shifts.
 * A financial day for Date D starts at 4:30 PM of Day D-1 
 * and ends at 4:30 PM of Day D.
 */

/**
 * Get the UTC range for a given date or range with a 4:30 PM cutoff in PST.
 * Per user instruction: 4:30 PM PST = 12:30 AM GMT (+8 hours).
 * A financial day D starts at 4:30 PM PST of Day D-1 and ends at 4:30 PM PST of Day D.
 */
function getFinancialRange(from, to) {
    const parseToUTCDateOnly = (input) => {
        if (!input) return new Date();
        const d = new Date(input);
        // Extract UTC components to avoid local timezone shifts during parsing
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    };

    const startDate = parseToUTCDateOnly(from);
    const endDate = to ? parseToUTCDateOnly(to) : startDate;

    const getPSTCutoffInUTC = (date) => {
        // As per user: 4:30 PM PST = 00:30 AM UTC Next Day
        const utc = new Date(date.getTime());
        // Set to 00:30 UTC of the NEXT calendar day
        utc.setUTCDate(utc.getUTCDate() + 1);
        utc.setUTCHours(0, 30, 0, 0);
        return utc;
    };

    // Financial Day D starts at PST cutoff of D-1
    const start = getPSTCutoffInUTC(startDate);
    start.setUTCDate(start.getUTCDate() - 1);

    // Financial Day D ends at PST cutoff of D
    const end = getPSTCutoffInUTC(endDate);

    return { start, end };
}

/**
 * Format a date into a readable string for reports using a fixed 8-hour shift.
 */
function formatToLocal(date) {
    if (!date) return '';
    const d = new Date(date);
    // PST = GMT - 8 hours
    const pstDate = new Date(d.getTime() - (8 * 3600 * 1000));
    return pstDate.toISOString().replace('T', ' ').substring(0, 19) + ' PST';
}

/**
 * Get the YYYY-MM-DD string for the financial day a date belongs to.
 * A financial day D starts at 4:30 PM PST of D-1 and ends at 4:30 PM PST of D.
 * Per user instruction: we use a fixed 8-hour offset.
 */
function getFinancialDateKey(date) {
    if (!date) return '';
    const d = new Date(date);

    // Per rules: 4:30 PM PST = 00:30 AM GMT (Next Day)
    // Any UTC timestamp strictly BEFORE 00:30 GMT belongs to the PREVIOUS calendar day label.
    // E.g., 2025-11-11 00:20 UTC belongs to 2025-11-10 financial day.

    // We can simulate this by subtracting 30 minutes from the UTC time.
    // Then the calendar day of that shifted time is the financial day.
    const shifted = new Date(d.getTime() - (30 * 60 * 1000));

    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth();
    const day = shifted.getUTCDate();

    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Get a Date object that represents the PST time (GMT - 8 hours).
 */
function getPSTTime(date) {
    if (!date) return new Date();
    return new Date(new Date(date).getTime() - (8 * 3600 * 1000));
}

const getPSTFinancialRange = getFinancialRange;
const formatToPST = formatToLocal;

module.exports = {
    getFinancialRange,
    formatToLocal,
    getFinancialDateKey,
    getPSTFinancialRange,
    formatToPST,
    getPSTTime
};
