export const isDescendantPath = (path: string, base: string) =>
  path.startsWith(`${base}/`) || path.startsWith(`${base}\\`);

export const isSameOrDescendant = (path: string | null | undefined, base: string) =>
  !!path && (path === base || isDescendantPath(path, base));
