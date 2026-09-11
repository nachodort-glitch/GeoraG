import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  emptyStore,
  submit,
  advance,
  completed,
  retry,
  correction,
  streak,
} from "../lib/game.ts";
import { validate } from "../lib/validation.ts";
const start = (ids = ["ESP", "FRA"], mode = "flag") => ({
  ...emptyStore(),
  game: createGame(ids, mode, "Europa", "normal", "v1", () => 0.99),
});
const answer = (s, ok) =>
  submit(s, s.game.sequence, ok, "respuesta", "2026-09-10");
const next = (s) => advance(s, s.game.sequence);
test("3 o 6 vidas exactas y derrota inmediata", () => {
  for (const mode of ["flag", "capital", "map", "expedition"]) {
    let s = start(["ESP", "FRA"], mode);
    const count = mode === "expedition" ? 6 : 3;
    assert.equal(s.game.lives, count);
    for (let i = 1; i <= count; i++) {
      s = answer(s, false);
      assert.equal(s.game.lives, count - i);
      assert.equal(s.game.status, i === count ? "lost" : "playing");
      if (i < count) s = next(s);
    }
    assert.equal(s.history.length, 1);
    assert.strictEqual(answer(s, false), s);
  }
});
test("doble envío y doble avance son idempotentes", () => {
  let s = start();
  let n = submit(s, 0, false, "x", "2026-09-10");
  assert.strictEqual(submit(n, 0, false, "x", "2026-09-10"), n);
  let a = next(n);
  assert.strictEqual(next(a), a);
  assert.strictEqual(submit(a, 0, true, "x", "2026-09-10"), a);
  assert.equal(a.game.lives, 2);
});
test("un fallo regresa después de otros pendientes", () => {
  let s = answer(start(), false);
  assert.equal(s.game.queue[0].country, "FRA");
  assert.equal(s.game.queue[1].country, "ESP");
  assert.equal(completed(s.game), 0);
  s = answer(next(s), true);
  assert.equal(completed(s.game), 1);
  assert.equal(s.game.status, "playing");
  s = answer(next(s), true);
  assert.equal(s.game.status, "won");
  assert.equal(completed(s.game), 2);
});
test("expedición conserva etapas acertadas y repite solo fallos", () => {
  let s = start(["ESP"], "expedition");
  s = answer(s, true);
  s = answer(next(s), false);
  s = answer(next(s), true);
  assert.deepEqual(s.game.passed.ESP, ["flag", "map"]);
  assert.equal(s.game.queue.length, 1);
  assert.equal(s.game.queue[0].skill, "capital");
  assert.equal(completed(s.game), 0);
  s = answer(next(s), true);
  assert.equal(s.game.status, "won");
  assert.equal(s.game.lives, 5);
  assert.equal(completed(s.game), 1);
});
test("recargar conserva feedback, vidas y pendientes", () => {
  let s = answer(start(), false);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(restored.game.lives, 2);
  assert.equal(restored.game.feedback.correct, false);
  assert.deepEqual(restored.game.queue, s.game.queue);
  assert.strictEqual(answer(restored, false), restored);
});
test("reintentar borra el intento y preserva aprendizaje e historial", () => {
  let s = start();
  for (let i = 0; i < 3; i++) s = answer(i ? next(s) : s, false);
  const n = retry(s, "v1");
  assert.equal(n.game.lives, 3);
  assert.deepEqual(n.game.passed, {});
  assert.equal(n.game.errors.length, 0);
  assert.notEqual(n.game.id, s.game.id);
  assert.deepEqual(n.history, s.history);
  assert.deepEqual(n.knowledge, s.knowledge);
  assert.equal(n.game.queue.length, 2);
});
test("normalización y variantes; no acepta otro país por similitud", () => {
  assert.equal(validate("  MÉXICO  ", ["México"], [], false), "correct");
  assert.equal(validate("Peru", ["Perú"], [], false), "correct");
  assert.equal(validate("Mali", ["Malta"], ["Mali"], false), "wrong");
  assert.equal(validate("Madrd", ["Madrid"], ["París"], false), "correction");
  assert.equal(validate("Madrd", ["Madrid"], ["París"], true), "wrong");
  assert.equal(validate("Mala", ["Malta"], ["Mali"], false), "wrong");
});
test("corrección es persistente y no resta vida ni registra acierto", () => {
  const s = correction(start(), 0);
  assert.equal(s.game.lives, 3);
  assert.equal(s.game.correctionUsed, true);
  assert.equal(Object.keys(s.knowledge).length, 0);
  assert.equal(JSON.parse(JSON.stringify(s)).game.correctionUsed, true);
});
test("no se recuperan vidas al acertar", () => {
  const s = answer(next(answer(start(), false)), true);
  assert.equal(s.game.lives, 2);
});
test("racha respeta días consecutivos y pausa de hoy", () => {
  assert.equal(streak(["2026-09-08", "2026-09-09"], "2026-09-10"), 2);
  assert.equal(streak(["2026-09-08"], "2026-09-10"), 0);
});
