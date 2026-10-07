import EVENT_CONFIG from "@/lib/event-config";

export default function UserFooter() {
  return <footer className="event-footer">
    <strong>{EVENT_CONFIG.name}</strong>
    <span>{EVENT_CONFIG.footerVenue}</span>
  </footer>;
}
