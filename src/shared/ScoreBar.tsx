import { Caption, Progress, Text } from "@telegram-apps/telegram-ui";

export function ScoreBar({ score, max = 10, label }: { score: number; max?: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-header">
        <Caption level="1">{label}</Caption>
        <Text weight="2">
          {score}/{max}
        </Text>
      </div>
      <Progress value={pct} />
    </div>
  );
}
