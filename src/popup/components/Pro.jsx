export default function Pro({
  themes = [],
  themeIndex = 0,
  onThemeChange = () => {},
}) {
  const COLORS = themes[themeIndex] || {};

  // Handle theme selection
  function handleThemeSelect(index) {
    localStorage.setItem("eqThemeIndex", JSON.stringify(index));
    onThemeChange(index);
  }

  // Render color picker circle with 45-degree split
  function renderThemeCircle(index, theme) {
    const bgColor = theme.BACKGROUND;
    const textColor = theme.TEXT;
    const isSelected = index === themeIndex;
    const isDisabled = index >= 2 && index <= 6;

    return (
      <button
        key={`theme-${index}`}
        onClick={() => !isDisabled && handleThemeSelect(index)}
        disabled={isDisabled}
        className={`relative w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
          isDisabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:scale-110"
        }`}
        style={{
          border: isSelected
            ? `3px solid ${COLORS.POINT}`
            : `3px solid ${COLORS.TEXT}b3`,
          boxShadow: isSelected ? `0 0 8px ${COLORS.POINT}` : "none",
        }}
      >
        {/* SVG with 45-degree diagonal split (mirrored vertically) */}
        <svg
          viewBox="0 0 100 100"
          className="w-[75%] h-[75%] rounded-full"
          style={{ overflow: "visible" }}
        >
          {/* Top-left semicircle (text color) - 45 degree split */}
          <path d="M 100 0 A 50 50 0 0 1 0 100 Z" fill={textColor} />
          {/* Bottom-right semicircle (background color) - mirrored 45 degree split */}
          <path d="M 100 0 A 50 50 0 0 0 0 100 Z" fill={bgColor} />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="w-[730px] h-[365px] ml-13 relative flex items-center justify-center border"
      style={{ borderColor: COLORS.TEXT }}
    >
      <div className="text-center" style={{ color: COLORS.TEXT }}>
        <h2 className="text-2xl font-bold mb-6">Ears Pro</h2>

        {/* Theme Color Picker */}
        <div className="mb-8">
          <p className="text-sm mb-4 font-semibold">Select Theme:</p>
          <div className="flex gap-4 justify-center flex-wrap">
            {themes.map((theme, index) => renderThemeCircle(index, theme))}
          </div>
        </div>

        <p className="text-sm mb-2">Upgrade to unlock premium features.</p>
        <p className="text-xs">Pro features coming soon...</p>
      </div>
    </div>
  );
}
