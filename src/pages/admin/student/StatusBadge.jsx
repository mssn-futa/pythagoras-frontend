const StatusBadge = ({ active }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-medium ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
    {active ? "Active" : "Inactive"}
  </span>
);

export default StatusBadge;
