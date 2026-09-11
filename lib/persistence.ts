import { emptyStore, type Store } from "./game";
import { byId, contentVersion } from "./content";
export const STORAGE_KEY = "geora.progress.v1";
export function parseStore(raw: string): Store {
  const s = JSON.parse(raw);
  if (
    s.version !== 1 ||
    !Array.isArray(s.history) ||
    !Array.isArray(s.days) ||
    !s.knowledge ||
    typeof s.knowledge !== "object"
  )
    throw Error("Formato de guardado no reconocido");
  const g = s.game;
  if (g) {
    if (g.contentVersion !== contentVersion)
      throw Error("La partida pertenece a otra versión del contenido.");
    if (
      !Array.isArray(g.ids) ||
      !g.ids.length ||
      !g.ids.every((id: string) => byId[id]) ||
      !Array.isArray(g.queue) ||
      !["playing", "won", "lost"].includes(g.status) ||
      !Number.isInteger(g.lives) ||
      g.lives < 0 ||
      g.lives > (g.mode === "expedition" ? 6 : 3) ||
      !g.queue.every(
        (t: { country: string; skill: string }) =>
          g.ids.includes(t.country) &&
          ["flag", "capital", "map"].includes(t.skill),
      ) ||
      !g.passed
    )
      throw Error("La partida guardada está dañada.");
  }
  return s as Store;
}
export function load(): Store {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? parseStore(raw) : emptyStore();
}
export function save(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
export const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
