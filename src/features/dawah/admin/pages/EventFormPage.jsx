import { useNavigate } from "react-router-dom";
import EventForm from "../components/EventForm.jsx";
import { Breadcrumbs, Card, PageHeader } from "../components/ui.jsx";
import { createEvent } from "../dawahAdminService.js";

/** /admin/events/new: creates a draft event, then opens it. */
export default function EventFormPage() {
  const navigate = useNavigate();
  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: "Events", to: "/admin/events" }, { label: "New event" }]} />
      <PageHeader title="New event" subtitle="The event is saved as a draft. Add audio and publish from its page." />
      <Card>
        <EventForm
          submitLabel="Create event"
          onSubmit={createEvent}
          onSaved={(event) => navigate(`/admin/events/${event.id}`, { state: { notice: "Draft event created." } })}
        />
      </Card>
    </section>
  );
}
