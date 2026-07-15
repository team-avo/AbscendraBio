// Directories served straight out of nextjs-frontend/public.
//
// resolveImageUrl assumes any other path is an upload living on the API host and
// prefixes it with API_BASE_URL. So a frontend asset missing from this list
// resolves to the API and 404s -- which is how /vial-mockups/ images broke.
//
// This lives in its own module because api.ts imports api-client.ts, so the two
// resolveImageUrl copies cannot import the list from one another.
export const FRONTEND_ASSET_DIRS = [
  "/peptide-ab/",
  "/products/",
  "/avatars/",
  "/vial-mockups/",
  "/logo",
];

export const isFrontendAsset = (url: string): boolean =>
  FRONTEND_ASSET_DIRS.some((dir) => url.startsWith(dir));
