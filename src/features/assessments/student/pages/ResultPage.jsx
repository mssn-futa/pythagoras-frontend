import { useParams } from "react-router-dom";
import { getResult } from "../api/studentAssessmentsApi.js";
import ResultSummary from "../components/ResultSummary.jsx";
import { ErrorPanel, Loading, Page } from "../components/StateBlocks.jsx";
import { useLoad } from "../hooks/useLoad.js";

/** /profile/results/:id — one persisted result, always read from the server. */
export default function ResultPage() {
  const { id } = useParams();
  const { loading, data, error, reload } = useLoad(() => getResult(id), id);
  if (loading) return <Page><Loading label="Loading result…" /></Page>;
  if (error) return <Page><ErrorPanel error={error} onRetry={error.status === 404 || error.status === 403 ? undefined : reload} title="We couldn't load this result" /></Page>;
  return <Page><ResultSummary result={data} /></Page>;
}
