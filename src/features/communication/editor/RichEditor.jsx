import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "../../auth/components/FormControls.jsx";
import { primaryButton, secondaryButton } from "../components/common.jsx";
import { validateLinkUrl } from "./richContent.js";
import { richExtensions } from "./richExtensions.js";

const toolbarButton =
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-transparent px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F] disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-[#2A742F] aria-pressed:bg-green-50 aria-pressed:text-[#2A742F] dark:text-gray-200 dark:hover:bg-gray-700 dark:aria-pressed:bg-green-950 dark:aria-pressed:text-green-300";

// Tailwind's preflight resets lists/headings, so the editing surface restores them locally.
const surfaceClass =
  "[&_.rich-editor-surface]:min-h-48 [&_.rich-editor-surface]:px-3 [&_.rich-editor-surface]:py-2 [&_.rich-editor-surface]:text-base [&_.rich-editor-surface]:leading-relaxed [&_.rich-editor-surface]:break-words [&_.rich-editor-surface]:outline-none " +
  "[&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-2 " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600 dark:[&_blockquote]:text-gray-300 " +
  "[&_a]:text-[#2A742F] [&_a]:underline dark:[&_a]:text-green-400";

// Nested blocks (list items) each add a separator; collapse to one blank line.
const snapshot = (editor) => ({
  html: editor.getHTML(),
  text: editor.getText({ blockSeparator: "\n\n" }).replace(/\n{3,}/g, "\n\n").trim(),
});

function LinkPanel({ editor, onClose }) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState(() => editor.getAttributes("link").href ?? "");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const hadLink = editor.isActive("link");

  useEffect(() => inputRef.current?.focus(), []);

  const apply = () => {
    const result = validateLinkUrl(value);
    if (!result.ok) return setError(result.message);
    if (editor.state.selection.empty && !hadLink) return setError("Select the text you want to turn into a link first.");
    editor.chain().focus().extendMarkRange("link").setLink({ href: result.href }).run();
    onClose();
  };
  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  };
  const onKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div role="group" aria-label="Link" className="space-y-2 border-b border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900">
      <label htmlFor={inputId} className="block text-sm font-medium text-[#4B5563] dark:text-gray-300">
        Link address (http:// or https://)
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="url"
        inputMode="url"
        autoComplete="off"
        className={inputClass}
        value={value}
        placeholder="https://example.com/page"
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className={primaryButton} onClick={apply}>
          Apply link
        </button>
        {hadLink && (
          <button type="button" className={secondaryButton} onClick={remove}>
            Remove link
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Toolbar({ editor, onLink }) {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const items = [
    ["Bold", "B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "font-bold"],
    ["Italic", "I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "italic"],
    ["Heading", "H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 })],
    ["Subheading", "H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 })],
    ["Bulleted list", "• List", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList")],
    ["Numbered list", "1. List", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList")],
    ["Quote", "Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote")],
    ["Link", "Link", onLink, editor.isActive("link")],
    ["Undo", "Undo", () => editor.chain().focus().undo().run(), undefined, "", !editor.can().undo()],
    ["Redo", "Redo", () => editor.chain().focus().redo().run(), undefined, "", !editor.can().redo()],
  ];

  // Roving tabindex: one tab stop for the toolbar, arrow keys move within it.
  const onKeyDown = (event) => {
    const buttons = [...ref.current.querySelectorAll("button:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    const move = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const target = buttons[(move + buttons.length) % buttons.length];
    setActive(Number(target.dataset.index));
    target.focus();
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-1 border-b border-gray-200 bg-white p-1.5 dark:border-gray-600 dark:bg-gray-800"
    >
      {items.map(([label, text, run, pressed, extra, disabled], index) => (
        <button
          key={label}
          type="button"
          data-index={index}
          aria-label={label}
          aria-pressed={pressed}
          tabIndex={index === active ? 0 : -1}
          disabled={disabled}
          // Keep the editor selection while clicking toolbar buttons.
          onMouseDown={(event) => event.preventDefault()}
          onFocus={() => setActive(index)}
          onClick={run}
          className={`${toolbarButton} ${extra ?? ""}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * Rich-text editor limited to the D4 allowlist. Uncontrolled after mount: `value`
 * (HTML) is the initial/canonical content; remount with a new `key` to load new
 * canonical content (e.g. after save or reload). `onChange({ html, text })` fires
 * on user edits only.
 */
export default function RichEditor({ value, onChange, labelledBy, id, invalid, describedBy, disabled = false }) {
  const [linkOpen, setLinkOpen] = useState(false);
  // useEditor re-applies these options on every render, so the ARIA attributes live here.
  const editor = useEditor({
    extensions: richExtensions(),
    content: value || "",
    editable: !disabled,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        id: id ?? "",
        role: "textbox",
        "aria-multiline": "true",
        class: "rich-editor-surface",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
    },
    onUpdate: ({ editor: current }) => onChange?.(snapshot(current)),
  });

  if (!editor) return null;
  return (
    <div className={`overflow-hidden rounded-lg border bg-white text-[#1F2937] focus-within:ring-2 focus-within:ring-[#2A742F] dark:bg-gray-900 dark:text-gray-100 ${invalid ? "border-red-500" : "border-gray-300 dark:border-gray-600"} ${surfaceClass}`}>
      <Toolbar editor={editor} onLink={() => setLinkOpen(true)} />
      {linkOpen && <LinkPanel editor={editor} onClose={() => setLinkOpen(false)} />}
      <EditorContent editor={editor} />
    </div>
  );
}
