# Communication automations (COMM-07)

Governing design: D4 "Automated summaries and event reminders" and "Frontend Design". Routes (inside `communicationRoutes`, `/admin/*`, `RequireAdmin`):
`/admin/communication/automations` (rule list), `/automations/new`, `/automations/:id` (edit, preview, enable/disable, run history). Run rows link to `/admin/communication/history/:broadcast_id`.

## Behaviour
- Rules start disabled; create always sends `enabled:false`; saving never enables. Enable/disable are explicit, confirmed, versioned actions.
- Weekly: weekday (0 = Monday), `local_time` HH:MM, timezone `Africa/Lagos` stated in the UI. Reminder: `offset_minutes` (entered as minutes/hours/days) and categories.
- Template: plain or rich (shared RichEditor/SafePreviewFrame), documented placeholders only (client rejects others and `{% %}` code).
- Preview is non-sending, `POST .../preview/ {version}`, rendered only in the sandboxed frame.
- Status wording: disabled / enabled ("not proof anything ran") / blocked owner. Run states: pending, queued, processing, completed, completed_with_errors, failed (provider), uncertain, skipped, missed, cancelled, blocked; unknown states/reason codes render verbatim, never guessed.
- Run history polls (5 s, max 60 polls, 3 failures) only while a run is pending/queued/processing; stops on terminal state/unmount, then offers manual refresh.

## Assumptions (not literally in D4; COMM-06 must confirm or the UI adjusts)
- Rule: `template{subject, body_format, body|body_html}`, `owner_id`, `owner_active`, `blocked_reason`, `version`; lists are D0-paginated (`page`, `page_size`).
- PATCH is versioned (`version` in body), never sends `kind`/`enabled`, always states `categories`; reassign is `PATCH {owner_id, version}`.
- enable/disable/preview bodies are `{version}`; enable/disable return the rule.
- Error codes: `AUTOMATION_VERSION_CONFLICT` (409), `AUTOMATION_OWNER_INACTIVE` (409); invalid schedule is 400/422 with `fields`.
- Category tokens `dawah_night`, `usroh`, `special_lecture`, `jumuah` (only `jumuah` is in D2/D4 examples); reminders require >= 1.
- Placeholders: weekly `week_start, week_end, summary_count, summaries`; reminder `event_title, event_start, event_location, event_summary, event_url`.
- Preview: `source{window_start, window_end, events[{id,title,category,start_time}]}`, `skip_reason_code`, `audience_count`, `rendered_html/text`.
- Run: `source{window_start, window_end, event{...}, event_revision}`, `recipient_count`, `counts`; reason codes listed in `automationModel.js` (unknown ones shown raw).
