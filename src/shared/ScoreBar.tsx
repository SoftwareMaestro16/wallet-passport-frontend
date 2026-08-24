export function ScoreBar({ score, max = 10, label }: { score: number; max?: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-header">
        <span>{label}</span>
        <span className="score-bar-value">
          {score}/{max}
        </span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
