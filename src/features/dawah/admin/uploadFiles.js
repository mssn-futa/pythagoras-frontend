import { DOCUMENT_LIMIT_BYTES, IMAGE_LIMIT_BYTES } from "./constants.js";
import { formatBytes } from "./time.js";

/*
 * Client-side pre-checks for documents and featured images (D2 "Domain Model":
 * PDF/DOCX up to 20 MiB; JPEG/PNG up to 10 MiB). These only save a round trip;
 * the server validates real content and is the authority. The declared
 * content_type is derived from the extension, never from the browser's guess
 * (browsers often report "" or a generic type for .docx).
 */

const DOCUMENT_TYPES = Object.freeze({
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});
const IMAGE_TYPES = Object.freeze({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" });

// Types browsers legitimately report for each extension (often generic or empty); the declared type still comes from the extension.
const OCTET = "application/octet-stream";
const BROWSER_TYPES = Object.freeze({
  pdf: [OCTET],
  docx: [OCTET, "application/zip", "application/x-zip-compressed"],
  jpg: ["image/pjpeg", OCTET],
  jpeg: ["image/pjpeg", OCTET],
  png: [OCTET],
});

const extensionOf = (name = "") => (/\.([A-Za-z0-9]+)$/.exec(name)?.[1] ?? "").toLowerCase();

export const documentContentType = (file) => DOCUMENT_TYPES[extensionOf(file?.name)] ?? null;
export const imageContentType = (file) => IMAGE_TYPES[extensionOf(file?.name)] ?? null;

function validate(file, { declared, limit, choose, only }) {
  if (!file) return choose;
  const accepted = [declared, ...(BROWSER_TYPES[extensionOf(file.name)] ?? [])];
  if (!declared || (file.type && !accepted.includes(file.type))) return only;
  if (file.size <= 0) return "That file is empty.";
  if (file.size > limit) return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(limit)}.`;
  return null;
}

export const validateDocumentFile = (file) =>
  validate(file, {
    declared: documentContentType(file),
    limit: DOCUMENT_LIMIT_BYTES,
    choose: "Choose a PDF or Word (.docx) file.",
    only: "Only PDF (.pdf) and Word (.docx) documents are accepted.",
  });

export const validateImageFile = (file) =>
  validate(file, {
    declared: imageContentType(file),
    limit: IMAGE_LIMIT_BYTES,
    choose: "Choose a JPEG or PNG image.",
    only: "Only JPEG (.jpg, .jpeg) and PNG (.png) images are accepted.",
  });
