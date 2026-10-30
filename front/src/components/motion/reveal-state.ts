const revealed = new Set<string>();
export function claimReveal(key: string) {
  if (revealed.has(key)) return false;
  revealed.add(key);
  return true;
}
