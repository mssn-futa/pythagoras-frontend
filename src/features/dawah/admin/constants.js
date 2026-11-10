// Constants shared by the Da'wah admin screens (kept local to avoid collisions
// with other work packages). Limits mirror D2 "Domain Model".

export const EVENT_STATUS = Object.freeze({ DRAFT: "draft", PUBLISHED: "published", UNPUBLISHED: "unpublished" });

export const STATUS_LABELS = Object.freeze({
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
});

/** Admin list filter. "all" is the draft-inclusive list (assumption: `status=all`). */
export const STATUS_FILTERS = Object.freeze([
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
]);

export const RESOURCE_TYPES = Object.freeze({ aud: "Audio", vid: "Video", doc: "Document" });

export const STORAGE_STATUS_LABELS = Object.freeze({
  ready: "Ready",
  not_applicable: "Not applicable",
  failed: "Failed",
  pending: "Pending",
  none: "No audio yet",
});

export const AUDIO_LIMIT_BYTES = 100 * 1024 * 1024; // MP3 maximum 100 MiB
export const AUDIO_CONTENT_TYPE = "audio/mpeg";
export const PAGE_SIZE = 20;
export const LIST_PAGE_SIZE_MAX = 100;

/** Suggestions only: the API accepts a free-text category (assumption). */
export const CATEGORY_SUGGESTIONS = Object.freeze(["jumuah", "lecture", "halaqah", "seminar"]);

export const LAGOS_TIME_ZONE = "Africa/Lagos";
