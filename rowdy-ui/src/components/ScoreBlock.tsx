interface ScoreBlockProps {
  final: number;
  proj?: number;
  color?: string;
  projectionColor?: string;
}

export default function ScoreBlock({ final, proj = 0, color, projectionColor }: ScoreBlockProps) {
  return (
    <span>
      <span style={{ color: color || "inherit" }}>{final}</span>
      {proj > 0 && (
        <span
          style={{
            fontSize: "0.6em",
            color: projectionColor || "var(--text-secondary)",
            marginLeft: 6,
            verticalAlign: "middle"
          }}
        >
          (+{proj})
        </span>
      )}
    </span>
  );
}
