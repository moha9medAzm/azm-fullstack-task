export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'warn' | 'danger';
}) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
