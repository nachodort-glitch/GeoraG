export const normalize = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
export function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = old;
    }
  }
  return row[b.length];
}
export function validate(
  input: string,
  accepted: string[],
  otherAnswers: string[],
  usedCorrection: boolean,
): "correct" | "correction" | "wrong" {
  const n = normalize(input);
  const exact = accepted.map(normalize);
  if (exact.includes(n)) return "correct";
  if (
    !usedCorrection &&
    n.length >= 4 &&
    !otherAnswers.some((a) => normalize(a) === n) &&
    exact.some((a) => a.length >= 4 && distance(a, n) === 1)
  ) {
    const otherNear = otherAnswers.some((a) => distance(normalize(a), n) <= 1);
    if (!otherNear) return "correction";
  }
  return "wrong";
}
