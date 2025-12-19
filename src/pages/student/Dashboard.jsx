import WelcomeSection from "../../features/dawah/components/WelcomeSection";
import QuickStats from "../../features/dawah/components/QuickStats";
import RecentActivity from "../../features/dawah/components/RecentActivity";
import UpcomingEvents from "../../features/dawah/components/UpcomingEvents";
import ContinueListening from "../../features/dawah/components/ContinueListening";
import ProgressOverview from "../../features/dawah/components/ProgressOverview";

export default function Dashboard() {
  return (
    <div className="space-y-6 pt-22">
      <WelcomeSection />
      <QuickStats />
      <UpcomingEvents />
      <RecentActivity />
      <ProgressOverview />
      <ContinueListening />
    </div>
  );
}
