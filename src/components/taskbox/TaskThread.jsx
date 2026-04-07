import TaskThreadMessage from "./TaskThreadMessage";
import TaskThreadSystemEvent from "./TaskThreadSystemEvent";

export default function TaskThread({ events = [] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {events.map((ev) =>
        ev.type === "message" ? (
          <TaskThreadMessage key={ev.id} event={ev} />
        ) : (
          <TaskThreadSystemEvent key={ev.id} event={ev} />
        )
      )}
    </div>
  );
}
