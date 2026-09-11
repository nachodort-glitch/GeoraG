export type Skill = "flag" | "capital" | "map";
export type Mode = Skill | "expedition";
export type Task = { country: string; skill: Skill };
export type Game = {
  id: string;
  contentVersion: string;
  mode: Mode;
  continent: string;
  difficulty: "normal" | "advanced";
  ids: string[];
  queue: Task[];
  passed: Record<string, Skill[]>;
  lives: number;
  sequence: number;
  correctionUsed: boolean;
  status: "playing" | "won" | "lost";
  feedback: null | { task: Task; correct: boolean; answer: string };
  errors: { task: Task; answer: string }[];
  startedAt: string;
};
export type History = {
  id: string;
  mode: Mode;
  continent: string;
  completed: number;
  total: number;
  errors: number;
  won: boolean;
  date: string;
};
export type Store = {
  version: 1;
  game: Game | null;
  history: History[];
  knowledge: Record<
    string,
    Partial<Record<Skill, { correct: number; wrong: number }>>
  >;
  days: string[];
};
export const emptyStore = (): Store => ({
  version: 1,
  game: null,
  history: [],
  knowledge: {},
  days: [],
});
export function shuffle<T>(list: T[], random = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function createGame(
  ids: string[],
  mode: Mode,
  continent: string,
  difficulty: "normal" | "advanced",
  contentVersion: string,
  random = Math.random,
): Game {
  if (!ids.length || new Set(ids).size !== ids.length)
    throw Error("Conjunto inválido");
  const order = shuffle(ids, random);
  return {
    id: globalThis.crypto.randomUUID(),
    contentVersion,
    mode,
    continent,
    difficulty,
    ids: [...ids],
    queue: order.flatMap((country) =>
      (mode === "expedition" ? ["flag", "capital", "map"] : [mode]).map(
        (skill) => ({ country, skill: skill as Skill }),
      ),
    ),
    passed: {},
    lives: mode === "expedition" ? 6 : 3,
    sequence: 0,
    correctionUsed: false,
    status: "playing",
    feedback: null,
    errors: [],
    startedAt: new Date().toISOString(),
  };
}
export function completed(g: Game) {
  return g.ids.filter(
    (id) => (g.passed[id]?.length ?? 0) === (g.mode === "expedition" ? 3 : 1),
  ).length;
}
export function submit(
  store: Store,
  sequence: number,
  correct: boolean,
  answer: string,
  day: string,
): Store {
  const g = store.game;
  if (!g || g.status !== "playing" || g.feedback || g.sequence !== sequence)
    return store;
  const task = g.queue[0];
  if (!task) return store;
  const next = structuredClone(store),
    n = next.game!;
  n.queue.shift();
  if (correct) {
    n.passed[task.country] = [...(n.passed[task.country] ?? []), task.skill];
  } else {
    n.lives -= 1;
    n.queue.push(task);
    n.errors.push({ task, answer });
  }
  n.feedback = { task, correct, answer };
  n.sequence++;
  n.correctionUsed = false;
  const k = (next.knowledge[task.country] ??= {});
  const value = (k[task.skill] ??= { correct: 0, wrong: 0 });
  value[correct ? "correct" : "wrong"]++;
  if (!next.days.includes(day)) next.days.push(day);
  if (n.lives === 0) n.status = "lost";
  else if (completed(n) === n.ids.length) n.status = "won";
  if (n.status !== "playing")
    next.history.unshift({
      id: n.id,
      mode: n.mode,
      continent: n.continent,
      completed: completed(n),
      total: n.ids.length,
      errors: n.errors.length,
      won: n.status === "won",
      date: new Date().toISOString(),
    });
  return next;
}
export function advance(store: Store, sequence: number): Store {
  if (
    !store.game ||
    store.game.sequence !== sequence ||
    !store.game.feedback ||
    store.game.status !== "playing"
  )
    return store;
  const next = structuredClone(store);
  next.game!.feedback = null;
  return next;
}
export function correction(store: Store, sequence: number): Store {
  if (
    !store.game ||
    store.game.sequence !== sequence ||
    store.game.correctionUsed ||
    store.game.feedback
  )
    return store;
  const next = structuredClone(store);
  next.game!.correctionUsed = true;
  return next;
}
export function retry(store: Store, version: string): Store {
  const g = store.game!;
  let n = createGame(g.ids, g.mode, g.continent, g.difficulty, version);
  if (g.ids.length > 1 && n.queue[0].country === g.queue[0]?.country) {
    const stages = n.mode === "expedition" ? 3 : 1;
    n.queue.push(...n.queue.splice(0, stages));
  }
  return { ...store, game: n };
}
export function streak(days: string[], today: string) {
  let count = 0,
    d = new Date(today + "T12:00:00Z");
  if (!days.includes(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (days.includes(d.toISOString().slice(0, 10))) {
    count++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return count;
}
