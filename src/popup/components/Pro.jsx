export default function Pro({ themes = [], themeIndex = 0 }) {
  const COLORS = themes[themeIndex] || {};
  return (
    <div
      className="w-[730px] h-[365px] ml-13 relative flex items-center justify-center border"
      style={{ borderColor: COLORS.TEXT }}
    >
      <div className="text-center" style={{ color: COLORS.TEXT }}>
        <h2 className="text-2xl font-bold mb-4">Ears Pro</h2>
        <p className="text-sm mb-2">Upgrade to unlock premium features.</p>
        <p className="text-xs">Pro features coming soon...</p>
      </div>
    </div>
  );
}
