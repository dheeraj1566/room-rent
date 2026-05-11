/**
 * Static lookup maps — replaces the SQL lookup tables
 * (FloorLevels, FurnishingTypes, FoodPreferences, ListingStatuses, PropertyTypes)
 *
 * In MongoDB we store the string value directly instead of a foreign-key integer.
 * These maps provide validation + ID↔name translation for backward compat with frontend.
 */

export const FLOOR_LEVELS: Record<number, string> = {
  1: "Ground Floor",
  2: "First Floor",
  3: "Second Floor",
  4: "Third Floor",
  5: "Roof",
};

export const FURNISHING_TYPES: Record<number, string> = {
  1: "Unfurnished",
  2: "Semi-Furnished",
  3: "Fully Furnished",
};

export const FOOD_PREFERENCES: Record<number, string> = {
  1: "Veg Only",
  2: "Non-Veg Allowed",
  3: "No Restriction",
};

export const LISTING_STATUSES: Record<number, string> = {
  1: "Active",
  2: "Paused",
  3: "Rented",
  4: "Expired",
  5: "Deleted",
};

export const PROPERTY_TYPES: Record<number, string> = {
  1: "PG",
  2: "Individual",
  3: "Flat",
};

export const COOLING_TYPES: Record<number, string> = {
  1: "AC",
  2: "Non-AC",
  3: "Cooler",
};

export const PROJECT_STATUS_TYPES: Record<number, string> = {
  1: "Under Construction",
  2: "Ready to Move",
  3: "New Launch",
};

export const ROOM_CATEGORIES: Record<number, string> = {
  1: "Single",
  2: "Shared",
  3: "Unshared",
};

// Reverse maps (name → id) for API responses that need numeric IDs
export const FLOOR_LEVELS_BY_NAME = Object.fromEntries(
  Object.entries(FLOOR_LEVELS).map(([id, name]) => [name, Number(id)])
);
export const FURNISHING_TYPES_BY_NAME = Object.fromEntries(
  Object.entries(FURNISHING_TYPES).map(([id, name]) => [name, Number(id)])
);
export const FOOD_PREFERENCES_BY_NAME = Object.fromEntries(
  Object.entries(FOOD_PREFERENCES).map(([id, name]) => [name, Number(id)])
);
export const LISTING_STATUSES_BY_NAME = Object.fromEntries(
  Object.entries(LISTING_STATUSES).map(([id, name]) => [name, Number(id)])
);
export const PROPERTY_TYPES_BY_NAME = Object.fromEntries(
  Object.entries(PROPERTY_TYPES).map(([id, name]) => [name, Number(id)])
);
export const COOLING_TYPES_BY_NAME = Object.fromEntries(
  Object.entries(COOLING_TYPES).map(([id, name]) => [name, Number(id)])
);
export const PROJECT_STATUS_TYPES_BY_NAME = Object.fromEntries(
  Object.entries(PROJECT_STATUS_TYPES).map(([id, name]) => [name, Number(id)])
);
export const ROOM_CATEGORIES_BY_NAME = Object.fromEntries(
  Object.entries(ROOM_CATEGORIES).map(([id, name]) => [name, Number(id)])
);

/** Resolve an ID or string to the canonical string name for a lookup */
export function resolveLookup(
  map: Record<number, string>,
  value: number | string | undefined | null
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return map[value] ?? null;
  // Already a string — validate it exists as a value
  const values = Object.values(map);
  if (values.includes(value)) return value;
  // Try parsing as number
  const num = Number(value);
  if (Number.isFinite(num) && map[num]) return map[num]!;
  return null;
}
