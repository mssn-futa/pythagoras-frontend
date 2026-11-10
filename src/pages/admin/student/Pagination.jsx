const btn = "px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";

const Pagination = ({ page, pageSize, count, onPage }) => {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-600" aria-live="polite">
        {`${count} ${count === 1 ? "student" : "students"} · Page ${page} of ${pages}`}
      </p>
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
};

export default Pagination;
