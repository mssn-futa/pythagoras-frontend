import { Link } from "react-router-dom";
import { RESOURCE_TYPES, STORAGE_STATUS_LABELS } from "../constants.js";
import { formatDuration } from "../time.js";
import { Badge, StatusBadge } from "./ui.jsx";

/** Responsive list of resources (cards, so it reads the same on phones). */
export default function ResourceTable({ resources, eventTitles = {} }) {
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700" aria-label="Resources">
      {resources.map((resource) => (
        <li key={resource.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/admin/events/${resource.eventId}/resources/${resource.id}`}
              className="font-medium text-[#2A742F] hover:underline break-words"
            >
              {resource.title || "Untitled resource"}
            </Link>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {RESOURCE_TYPES[resource.type] ?? resource.type}
              {" · "}
              {formatDuration(resource.duration)}
              {eventTitles[resource.eventId] ? ` · ${eventTitles[resource.eventId]}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={resource.status} />
            <Badge tone={resource.storageStatus === "ready" ? "ready" : resource.storageStatus === "failed" ? "failed" : undefined}>
              {STORAGE_STATUS_LABELS[resource.storageStatus] ?? resource.storageStatus}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
