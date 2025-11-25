import { useEffect, useState } from "react";

export default function LastUpdated() {
  const [timestamp, setTimestamp] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center text-xs text-slate-400 mt-5 pb-5">
      Last updated: {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  );
}
