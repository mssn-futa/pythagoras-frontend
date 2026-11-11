/** True for the errors browsers raise when a lazily imported route chunk cannot be fetched. */
export function isChunkLoadError(error) {
  const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return (
    error?.name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (CSS )?chunk [\w-]+ failed|Unable to preload CSS/i.test(text)
  );
}
