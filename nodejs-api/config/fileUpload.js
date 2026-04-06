/**
 * Centralized configuration for file uploads
 */

const ALLOWED_MIME_TYPES = {
    // Standard safe types for reports and general uploads
    SAFE_LIST: [
        'application/pdf',
        'image/jpeg',
        'image/png'
    ],
    // Only image types
    IMAGES: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml'
    ],
    // Excel types for data import/export
    EXCEL: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
    ]
};

/**
 * Validates if a mimetype is in the provided list
 * @param {string} mimetype - The MIME type to check
 * @param {string[]} allowedList - The list of allowed MIME types
 * @returns {boolean}
 */
const isValidMimeType = (mimetype, allowedList) => {
    return allowedList.includes(mimetype);
};

module.exports = {
    ALLOWED_MIME_TYPES,
    isValidMimeType
};
