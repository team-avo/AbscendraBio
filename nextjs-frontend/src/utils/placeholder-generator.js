// Simple placeholder image generator for development
// This creates basic SVG placeholders to avoid 404 errors

const generateProductPlaceholder = (
  width: number,
  height: number,
  productName: string
) => {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f1f5f9"/>
    <rect x="20" y="20" width="${width - 40}" height="${
    height - 40
  }" fill="#e2e8f0" rx="8"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="16" fill="#64748b">${productName}</text>
  </svg>`;
};

const generateAvatarPlaceholder = (size: number, initials: string) => {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#3b82f6"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${
      size / 3
    }" fill="white" font-weight="bold">${initials}</text>
  </svg>`;
};

// Export the functions for use
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateProductPlaceholder, generateAvatarPlaceholder };
}
