import { useCallback, useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/index.js";
import { FormAlert, FormNotice } from "../../auth/components/FormControls.jsx";
import { describeFormError } from "../../auth/formErrors.js";
import { createRule, disableRule, enableRule, getRule, previewRule, reassignRule, updateRule } from "../api/automationsApi.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { cardClass, LoadingLine, PageError, primaryButton, secondaryButton } from "../components/common.jsx";
import { audienceLabel, withoutStaleErrors } from "../model.js";
import {
  EMPTY_RULE_FORM, KIND_LABELS, formToDraft, ruleFormKey, ruleStatus, ruleToForm, scheduleSummary, validateRuleForm, TIMEZONE,
} from "../automations/automationModel.js";
import RuleFormFields from "../automations/RuleFormFields.jsx";
import RunHistory from "../automations/RunHistory.jsx";
import RulePreview from "../automations/RulePreview.jsx";
import { RuleStatusBadge } from "./AutomationsPage.jsx";

const FORM_FIELDS = ["subject", "body", "body_html", "template", "audience", "department", "level", "categories", "weekday", "local_time", "timezone", "offset_minutes"];
const VERSION_CONFLICT = "AUTOMATION_VERSION_CONFLICT"; // ASSUMPTION: mirrors BROADCAST_VERSION_CONFLICT
const OWNER_INACTIVE = "AUTOMATION_OWNER_INACTIVE"; // ASSUMPTION
const amberBox = "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200";

/** Server may name nested template errors "template.subject"; the form shows them under the plain field name. */
function flattenFieldErrors(error) {
  if (!error?.fields) return error;
  const fields = {};
  for (const [name, messages] of Object.entries(error.fields)) {
    const key = name.startsWith("template.") ? name.slice("template.".length) : name;
    fields[key] = [...(fields[key] ?? []), ...messages];
  }
  return { ...error, fields };
}

function Editor({ id }) {
  const formId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState(id ? "loading" : "ready");
  const [loadError, setLoadError] = useState(null);
  const [rule, setRule] = useState(null);
  const [form, setForm] = useState(EMPTY_RULE_FORM);
  const [baseline, setBaseline] = useState(ruleFormKey(EMPTY_RULE_FORM));
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState(location.state?.created ? "Rule saved. It starts disabled: nothing is scheduled and no email will be sent until you enable it." : null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [dialog, setDialog] = useState(null); // "enable" | "disable"
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [runsKey, setRunsKey] = useState(0);

  const adopt = useCallback((next) => {
    const nextForm = ruleToForm(next);
    setRule(next);
    setForm(nextForm);
    setBaseline(ruleFormKey(nextForm));
    setEditorEpoch((epoch) => epoch + 1);
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError(null);
    try {
      adopt(await getRule(id));
      setStatus("ready");
    } catch (caught) {
      setLoadError(caught);
      setStatus("error");
    }
  }, [id, adopt]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const dirty = ruleFormKey(form) !== baseline;
  const change = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setFieldErrors((current) => withoutStaleErrors(current, patch));
    setNotice(null);
  };

  const failWith = (caught) => {
    const { message, fields } = describeFormError(flattenFieldErrors(caught), FORM_FIELDS);
    setFieldErrors(fields);
    setError(message);
  };

  const save = async (event) => {
    event.preventDefault();
    setNotice(null);
    setError(null);
    const errors = validateRuleForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      if (rule) {
        adopt(await updateRule(rule.id, formToDraft(form), rule.version));
        setNotice("Rule saved. Saving changes does not enable the rule or prove that anything ran.");
        setPreview(null);
      } else {
        const created = await createRule(formToDraft(form));
        navigate(`/admin/communication/automations/${created.id}`, { replace: true, state: { created: true } });
      }
    } catch (caught) {
      if (caught?.code === VERSION_CONFLICT) setConflict(true);
      else failWith(caught);
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    setError(null);
    try {
      adopt(await getRule(rule.id));
      setConflict(false);
      setPreview(null);
      setFieldErrors({});
      setNotice("Reloaded the latest saved version.");
    } catch (caught) {
      failWith(caught);
    }
  };

  const runPreview = async () => {
    setError(null);
    setPreviewing(true);
    try {
      setPreview({ version: rule.version, data: await previewRule(rule.id, rule.version) });
    } catch (caught) {
      if (caught?.code === VERSION_CONFLICT) {
        setConflict(true);
        setPreview(null);
      } else failWith(caught);
    } finally {
      setPreviewing(false);
    }
  };

  const confirmLifecycle = async () => {
    setLifecycleError(null);
    setLifecycleBusy(true);
    try {
      const updated = await (dialog === "enable" ? enableRule : disableRule)(rule.id, rule.version);
      setRule(updated);
      setDialog(null);
      setRunsKey((key) => key + 1);
      setNotice(
        dialog === "enable"
          ? "Rule enabled. The worker may now create runs on this schedule; check run history to confirm that it does."
          : "Rule disabled. Occurrences not yet created are cancelled; mail already handed to the provider follows delivery policy.",
      );
    } catch (caught) {
      if (caught?.code === VERSION_CONFLICT) {
        setDialog(null);
        setConflict(true);
      } else if (caught?.code === OWNER_INACTIVE) {
        setDialog(null);
        setRule((current) => ({ ...current, blockedReason: "owner_inactive", ownerActive: false }));
        setError("The rule owner is not an active admin, so the rule cannot be enabled. Assign the rule to yourself, then try again.");
      } else if (caught?.status === 400 || caught?.status === 422) {
        setDialog(null);
        failWith(caught);
      } else {
        setLifecycleError(describeFormError(caught, []).message);
      }
    } finally {
      setLifecycleBusy(false);
    }
  };

  const assignToMe = async () => {
    setError(null);
    setAssigning(true);
    try {
      setRule(await reassignRule(rule.id, user.id, rule.version));
      setNotice("Rule assigned to you.");
    } catch (caught) {
      if (caught?.code === VERSION_CONFLICT) setConflict(true);
      else failWith(caught);
    } finally {
      setAssigning(false);
    }
  };

  if (status === "loading") return <LoadingLine>Loading rule…</LoadingLine>;
  if (status === "error") return <PageError error={loadError} onRetry={load} />;

  const activePreview = preview && rule && preview.version === rule.version && !dirty ? preview.data : null;
  const saved = Boolean(rule) && !dirty && !conflict;
  const state = rule ? ruleStatus(rule) : null;
  const blocked = state?.key === "blocked";
  const unsupported = rule?.kind === "unknown";
  // The saved version must itself be valid before it can be enabled; reasons are listed next to the button.
  const savedErrors = rule && !unsupported ? validateRuleForm(ruleToForm(rule)) : {};
  const savedProblems = Object.values(savedErrors).flat();

  return (
    <div className="space-y-6">
      <Link to="/admin/communication/automations" className="text-sm font-medium text-[#2A742F] underline">Back to automations</Link>

      {rule && (
        <section aria-labelledby={`${formId}-status`} className={`${cardClass} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`${formId}-status`} className="text-lg font-semibold text-[#1F2937] dark:text-white">
              {KIND_LABELS[rule.kind] ?? "Automation"} rule #{rule.id}
            </h2>
            <RuleStatusBadge rule={rule} />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200">{state.help}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">Schedule</dt><dd>{scheduleSummary(rule)}</dd></div>
            <div><dt className="font-medium">Audience</dt><dd>{audienceLabel(rule.audience)}</dd></div>
            <div><dt className="font-medium">Owner</dt><dd>Admin #{rule.ownerId ?? "unknown"}{rule.ownerActive === false ? " (inactive)" : ""}</dd></div>
          </dl>
          {blocked && (
            <div role="alert" className={amberBox}>
              <p className="font-medium">No new runs are created while the owner is inactive.</p>
              <p className="mt-1">Reassign the rule to an active admin to resume it.</p>
              <button type="button" className={`${secondaryButton} mt-3`} onClick={assignToMe} disabled={assigning || conflict}>
                {assigning ? "Assigning…" : "Assign to me"}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {rule.enabled ? (
              <button type="button" className={secondaryButton} onClick={() => { setLifecycleError(null); setDialog("disable"); }} disabled={conflict}>Disable…</button>
            ) : (
              <button type="button" className={primaryButton} onClick={() => { setLifecycleError(null); setDialog("enable"); }} disabled={!saved || blocked || unsupported || savedProblems.length > 0}>Enable…</button>
            )}
          </div>
          {!rule.enabled && savedProblems.length > 0 && (
            <div role="status" className={amberBox}>
              <p className="font-medium">This saved rule cannot be enabled yet:</p>
              <ul className="mt-1 list-disc pl-5">
                {savedProblems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          )}
          {!rule.enabled && !saved && !conflict && <p className="text-xs text-gray-500">Save your changes before enabling. Enabling applies the saved version, never unsaved edits.</p>}
        </section>
      )}

      {unsupported ? (
        <div role="alert" className={amberBox}>
          <p className="font-medium">Unsupported rule type.</p>
          <p className="mt-1">This page does not recognise this rule's type, so it cannot be edited, previewed or enabled here. {rule.enabled ? "You can still disable it and review its run history." : "Its run history is shown below."}</p>
        </div>
      ) : (
      <form onSubmit={save} noValidate className={`${cardClass} space-y-4`} aria-labelledby={`${formId}-title`}>
        <h2 id={`${formId}-title`} className="text-lg font-semibold text-[#1F2937] dark:text-white">{rule ? "Edit rule" : "New automation rule"}</h2>
        {!rule && <p className="text-sm text-gray-600 dark:text-gray-300">The rule is saved <strong>disabled</strong>. Saving does not schedule or send anything; you enable it explicitly afterwards.</p>}
        {rule?.enabled && <p className={amberBox}>This rule is enabled. Saved changes can affect upcoming occurrences; occurrences already created keep the content and audience they were created with.</p>}
        <FormNotice>{notice}</FormNotice>
        <FormAlert>{error}</FormAlert>
        {conflict && (
          <div role="alert" className={amberBox}>
            <p className="font-medium">This rule was changed somewhere else.</p>
            <p className="mt-1">Your edits were not saved and nothing was overwritten. Reload to load the latest saved version; your unsaved text stays on screen until you do.</p>
            <button type="button" onClick={reload} className={`${secondaryButton} mt-3`}>Reload latest version</button>
          </div>
        )}
        <RuleFormFields form={form} onChange={change} errors={fieldErrors} disabled={saving} kindLocked={Boolean(rule)} editorEpoch={editorEpoch} onEditorReset={() => setEditorEpoch((epoch) => epoch + 1)} />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="submit" className={primaryButton} disabled={saving || conflict || (Boolean(rule) && !dirty)}>
            {saving ? "Saving…" : rule ? "Save changes" : "Save as disabled rule"}
          </button>
          <button type="button" className={secondaryButton} onClick={runPreview} disabled={!saved || previewing}>
            {previewing ? "Loading preview…" : "Preview (no email sent)"}
          </button>
        </div>
        {!saved && !conflict && <p className="text-xs text-gray-500">Save the rule to preview it. The preview uses the saved version.</p>}
      </form>
      )}

      {activePreview && <RulePreview preview={activePreview} />}
      {rule && <RunHistory ruleId={rule.id} refreshKey={runsKey} />}

      {dialog === "enable" && (
        <ConfirmDialog title="Enable this rule?" confirmLabel="Enable rule" busyLabel="Enabling…" busy={lifecycleBusy} error={lifecycleError} onConfirm={confirmLifecycle} onCancel={() => setDialog(null)}>
          <dl className="space-y-2">
            <div><dt className="font-medium">Rule</dt><dd>{KIND_LABELS[rule.kind]}: {rule.template.subject}</dd></div>
            <div><dt className="font-medium">Schedule</dt><dd>{scheduleSummary(rule)}{rule.kind === "weekly_digest" ? "" : `; event times shown in ${TIMEZONE}`}</dd></div>
            <div><dt className="font-medium">Audience</dt><dd>{audienceLabel(rule.audience)}</dd></div>
            {activePreview?.audienceCount != null && <div><dt className="font-medium">Estimated recipients</dt><dd>About {activePreview.audienceCount} (advisory)</dd></div>}
          </dl>
          <p className={amberBox}>Once enabled, the worker will email real students on this schedule. Enabling only turns the rule on: it is not proof that anything has been or will be sent, so check run history afterwards. Test rules should target controlled recipients.</p>
        </ConfirmDialog>
      )}
      {dialog === "disable" && (
        <ConfirmDialog title="Disable this rule?" confirmLabel="Disable rule" busyLabel="Disabling…" busy={lifecycleBusy} error={lifecycleError} onConfirm={confirmLifecycle} onCancel={() => setDialog(null)}>
          <p>Occurrences that have not been created yet are cancelled. Mail already handed to the email provider cannot be recalled and follows normal delivery policy; unsent recipients of existing runs may be cancelled with an audit record.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/** automations/new and automations/:id. Keyed by id so state never leaks between rules. */
export default function AutomationRulePage() {
  const { id } = useParams();
  return <Editor key={id ?? "new"} id={id} />;
}
