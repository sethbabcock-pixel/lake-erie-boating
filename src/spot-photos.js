// Header photos for launch pages, keyed by spot id (functions/marine/conditions.js SPOTS).
//
// Bundled defaults: freely licensed photos (Wikimedia Commons, commercial use
// allowed: public domain, CC0, CC BY, CC BY-SA) resized into public/spots/.
// Each must show the water at or near that launch. The credit line renders on
// the photo, which is what the BY / BY-SA licenses require.
//
// The admin can override any spot with an upload (Admin → Homepage hero →
// Photo by launch), stored in site config as hero.spots[id].
//
// Shape: id: { src, title, credit, license, licenseUrl, source }
//   src        site path to the resized image, e.g. "/spots/put-in-bay.jpg"
//   title      short file title
//   credit     author as Commons attributes them
//   license    short name, e.g. "CC BY-SA 4.0", "Public domain"
//   licenseUrl the license deed ("" for public domain)
//   source     the Commons file page URL
// Share-alike: the resized files stay reusable under their own license; never
// bake text or logos into them.
export const SPOT_PHOTOS = {
};

// The photo for a launch page: the admin's upload for that launch, else the
// bundled photo, else the admin's photo for the launch's region. null = none
// (the page shows a plain title band; never another place's photo).
export function spotPhoto(hero, spotId, regionSlug) {
  const up = hero && hero.spots && spotId && hero.spots[spotId];
  if (up) return { src: up, credit: "", license: "", source: "" };
  const own = spotId && SPOT_PHOTOS[spotId];
  if (own) return own;
  const reg = hero && hero.regions && regionSlug && hero.regions[regionSlug];
  if (reg) return { src: reg, credit: "", license: "", source: "" };
  return null;
}
