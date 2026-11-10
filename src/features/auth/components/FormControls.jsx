import { useId, useState } from "react";
import Spinner from "./Spinner.jsx";

export const inputClass =
  "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-800 text-[#000000] dark:text-white focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all disabled:bg-gray-100 disabled:text-[#4B5563] dark:disabled:bg-gray-900 dark:disabled:text-gray-400";

const labelClass = "block text-sm font-medium text-[#4B5563] dark:text-gray-300 mb-1";

function useFieldIds(errors) {
  const id = useId();
  const errorId = `${id}-error`;
  const message = errors?.length ? errors.join(" ") : null;
  return { id, errorId, message };
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

export function TextField({ label, errors, hint, className = "", ...inputProps }) {
  const { id, errorId, message } = useFieldIds(errors);
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {hint && <span className="ml-1 font-normal text-xs text-gray-400">{hint}</span>}
      </label>
      <input
        id={id}
        className={inputClass}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        {...inputProps}
      />
      <FieldError id={errorId} message={message} />
    </div>
  );
}

export function PasswordField({ label, errors, className = "", ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const { id, errorId, message } = useFieldIds(errors);
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`${inputClass} pr-11`}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? errorId : undefined}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] dark:text-gray-300 hover:text-[#2A742F] transition-all"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {visible ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            ) : (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </>
            )}
          </svg>
        </button>
      </div>
      <FieldError id={errorId} message={message} />
    </div>
  );
}

export function SelectField({ label, errors, hint, options, placeholder, className = "", ...selectProps }) {
  const { id, errorId, message } = useFieldIds(errors);
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {hint && <span className="ml-1 font-normal text-xs text-gray-400">{hint}</span>}
      </label>
      <select
        id={id}
        className={inputClass}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        {...selectProps}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={message} />
    </div>
  );
}

export function SubmitButton({ loading, loadingLabel = "Loading...", children, className = "", disabled, ...props }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={`w-full py-3 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormAlert({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
      {children}
    </div>
  );
}

export function FormNotice({ children }) {
  if (!children) return null;
  return (
    <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-[#2A742F] dark:border-green-800 dark:bg-green-950 dark:text-green-300">
      {children}
    </div>
  );
}
