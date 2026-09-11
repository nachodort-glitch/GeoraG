import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const countries = JSON.parse(fs.readFileSync("lib/countries.json", "utf8"));
const world = JSON.parse(fs.readFileSync("public/data/world.json", "utf8"));
test("195 países únicos con bandera SVG, capital, coordenadas y polígonos", () => {
  assert.equal(countries.length, 195);
  assert.equal(new Set(countries.map((c) => c.id)).size, 195);
  for (const c of countries) {
    assert.ok(c.capital);
    assert.ok(c.capitalAliases.includes(c.capital), c.id);
    assert.ok(c.aliases.includes(c.name), c.id);
    assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180);
    assert.ok(
      world.features.some((f) => f.properties.id === c.id),
      "Sin mapa: " + c.id,
    );
    assert.ok(
      fs
        .readFileSync("public/flags/" + c.code + ".svg", "utf8")
        .includes("<svg"),
    );
  }
});
test("continentes exclusivos y cantidades coherentes", () => {
  assert.deepEqual(
    Object.fromEntries(
      ["África", "América", "Asia", "Europa", "Oceanía"].map((r) => [
        r,
        countries.filter((c) => c.continent === r).length,
      ]),
    ),
    { África: 54, América: 35, Asia: 47, Europa: 45, Oceanía: 14 },
  );
});
test("anillos cerrados y coordenadas finitas", () => {
  for (const f of world.features) {
    const polygons =
      f.geometry.type === "Polygon"
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;
    for (const p of polygons)
      for (const r of p) {
        assert.ok(r.length >= 4);
        assert.deepEqual(r[0], r.at(-1));
        for (const v of r) assert.ok(v.every(Number.isFinite));
      }
  }
});
