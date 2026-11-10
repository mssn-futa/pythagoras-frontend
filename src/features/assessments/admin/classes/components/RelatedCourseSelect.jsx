import { useEffect, useState } from "react";
import { inputClass } from "../../components/styles.js";
import { FieldError } from "../../components/ui.jsx";
import { listClasses } from "../classService.js";

/**
 * Optional related_course for a quiz draft (D3: reuse class data; the course never restricts quiz
 * eligibility). Offers Arabic classes only. A class that failed to load or is not in the list still
 * shows as "Class #id" so an existing association is never hidden or silently cleared.
 */
export default function RelatedCourseSelect({ value, onChange, disabled, error }) {
  const [classes, setClasses] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    listClasses({ pageSize: 100 })
      .then((loaded) => live && setClasses(loaded.results.filter((item) => !item.legacy)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const options = (classes ?? []).filter((item) => item.status !== "closed" || String(item.id) === String(value));
  const known = options.some((item) => String(item.id) === String(value));
  return (
    <div>
      <label htmlFor="quiz-related-course" className="mb-2 block text-sm font-medium text-gray-700">
        Related Arabic class (optional)
      </label>
      <select
        id="quiz-related-course"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "related_course-error" : undefined}
        className={inputClass(error)}
      >
        <option value="">None</option>
        {value !== "" && !known && <option value={value}>Class #{value}</option>}
        {options.map((item) => (
          <option key={item.id} value={String(item.id)}>
            {item.code}: {item.title} ({item.status})
          </option>
        ))}
      </select>
      <FieldError id="related_course-error">{error}</FieldError>
      {failed && <p className="mt-1 text-xs text-amber-800">Classes could not be loaded. The current link, if any, is kept.</p>}
      <p className="mt-1 text-xs text-gray-500">Linking a class does not limit who can take the quiz. The link is locked once the quiz is published.</p>
    </div>
  );
}
