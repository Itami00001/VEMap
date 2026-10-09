export default function DemoBadge() {
  const useMocks = String(import.meta.env.VITE_USE_MOCKS ?? 'false') === 'true'
  if (!useMocks) return null
  return <span className="muted">DEMO DATA — тестовые данные</span>
}