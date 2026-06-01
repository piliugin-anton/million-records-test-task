export function matchesQuery(id: string, query: string): boolean {
  return query === "" || id.includes(query);
}
