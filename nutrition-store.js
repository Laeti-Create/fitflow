let nutritionEntries = [];
const subscribers = new Set();

function notify(change) {
  const snapshot = getNutritionEntries();
  subscribers.forEach((subscriber) => {
    try {
      subscriber(snapshot, change);
    } catch (error) {
      console.warn("Nutrition store subscriber error:", error);
    }
  });
}

export function getNutritionEntries() {
  return nutritionEntries;
}

export function replaceNutritionEntries(entries) {
  nutritionEntries = Array.isArray(entries) ? [...entries] : [];
  notify({ type: "replace" });
  return nutritionEntries;
}

export function addNutritionEntryToStore(entry) {
  if (!entry) return nutritionEntries;
  const existingIndex = entry.id
    ? nutritionEntries.findIndex((item) => item.id === entry.id)
    : -1;

  if (existingIndex >= 0) {
    nutritionEntries = nutritionEntries.map((item, index) =>
      index === existingIndex ? { ...item, ...entry } : item
    );
  } else {
    nutritionEntries = [entry, ...nutritionEntries];
  }

  notify({ type: "add", id: entry.id || null });
  return entry;
}

export function updateNutritionEntryInStore(entryId, updates, fallbackIndex = null) {
  const index = entryId
    ? nutritionEntries.findIndex((entry) => entry.id === entryId)
    : fallbackIndex;
  if (!Number.isInteger(index) || index < 0 || !nutritionEntries[index]) return null;

  const updated = { ...nutritionEntries[index], ...updates };
  nutritionEntries = nutritionEntries.map((entry, entryIndex) =>
    entryIndex === index ? updated : entry
  );
  notify({ type: "update", id: updated.id || entryId || null });
  return updated;
}

export function removeNutritionEntryFromStore(entryId, fallbackIndex = null) {
  const index = entryId
    ? nutritionEntries.findIndex((entry) => entry.id === entryId)
    : fallbackIndex;
  if (!Number.isInteger(index) || index < 0 || !nutritionEntries[index]) return null;

  const removed = nutritionEntries[index];
  nutritionEntries = nutritionEntries.filter((_, entryIndex) => entryIndex !== index);
  notify({ type: "remove", id: removed.id || entryId || null });
  return removed;
}

export function subscribeToNutritionEntries(subscriber, { immediate = false } = {}) {
  if (typeof subscriber !== "function") return () => {};
  subscribers.add(subscriber);
  if (immediate) subscriber(getNutritionEntries(), { type: "subscribe" });
  return () => subscribers.delete(subscriber);
}
