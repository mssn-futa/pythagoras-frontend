import { useId } from "react";
import { inputClass } from "../../auth/components/FormControls.jsx";
import { LEVELS } from "../model.js";

const OPTIONS = [
  ["all", "All active students"],
  ["department", "One department"],
  ["level", "One level"],
];

/** Audience controls: all / department / level. Only the selector of the chosen type is shown. */
export default function AudienceSelector({ value, errors, onChange, disabled }) {
  const id = useId();
  const message = errors?.length ? errors.join(" ") : null;
  const set = (patch) => onChange(patch); // callers merge the patch, so only the edited fields count as changed
  return (
    <fieldset disabled={disabled} aria-describedby={message ? `${id}-error` : undefined} className="min-w-0">
      <legend className="mb-1 block text-sm font-medium text-[#4B5563] dark:text-gray-300">Audience</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
        {OPTIONS.map(([type, label]) => (
          <label key={type} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="radio"
              name={`${id}-audience`}
              value={type}
              checked={value.audienceType === type}
              onChange={() => set({ audienceType: type })}
              className="h-4 w-4 accent-[#2A742F]"
            />
            {label}
          </label>
        ))}
      </div>
      {value.audienceType === "department" && (
        <div className="mt-3">
          <label htmlFor={`${id}-department`} className="mb-1 block text-sm font-medium text-[#4B5563] dark:text-gray-300">
            Department
          </label>
          <input
            id={`${id}-department`}
            className={inputClass}
            value={value.department}
            maxLength={100}
            onChange={(event) => set({ department: event.target.value })}
            aria-invalid={message ? true : undefined}
          />
        </div>
      )}
      {value.audienceType === "level" && (
        <div className="mt-3">
          <label htmlFor={`${id}-level`} className="mb-1 block text-sm font-medium text-[#4B5563] dark:text-gray-300">
            Level
          </label>
          <select
            id={`${id}-level`}
            className={inputClass}
            value={value.level}
            onChange={(event) => set({ level: event.target.value })}
            aria-invalid={message ? true : undefined}
          >
            <option value="">Choose a level</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level} level
              </option>
            ))}
          </select>
        </div>
      )}
      {message && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {message}
        </p>
      )}
    </fieldset>
  );
}
