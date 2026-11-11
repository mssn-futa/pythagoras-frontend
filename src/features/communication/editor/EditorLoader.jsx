import { Component, lazy, Suspense, useState } from "react";
import { LoadingLine, secondaryButton } from "../components/common.jsx";

const loadRichEditor = () => import("./RichEditor.jsx");

class EditorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
        <p className="font-medium">The rich-text editor could not be loaded.</p>
        <p className="mt-1">Check your connection and try again. Your subject and audience are kept, and you can switch to plain text above.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" className={secondaryButton} onClick={this.props.onRetry}>
            Try again
          </button>
          <button type="button" className={secondaryButton} onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Lazy-loads the editor chunk with a recovery UI. React.lazy caches a rejected import,
 * so "Try again" builds a fresh lazy component (and boundary) to re-request the chunk.
 * `loader` is injectable for tests.
 */
export default function EditorLoader({ loader = loadRichEditor, ...editorProps }) {
  const [attempt, setAttempt] = useState(0);
  const [Editor, setEditor] = useState(() => lazy(loader));
  const retry = () => {
    setEditor(() => lazy(loader));
    setAttempt((count) => count + 1);
  };
  return (
    <EditorBoundary key={attempt} onRetry={retry}>
      <Suspense fallback={<LoadingLine>Loading editor…</LoadingLine>}>
        <Editor {...editorProps} />
      </Suspense>
    </EditorBoundary>
  );
}
