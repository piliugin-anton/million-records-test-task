export function parseIds(value: string) {
  return value.split(/[\s,;]+/).map((id) => id.trim()).filter(Boolean);
}
