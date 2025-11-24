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
    <div style={{ 
      textAlign: 'center', 
      fontSize: '0.75rem', 
      color: '#94a3b8', 
      marginTop: 20, 
      paddingBottom: 20 
    }}>
      Last updated: {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  );
}
