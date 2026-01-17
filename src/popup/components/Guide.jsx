export default function Guide({ themes = [], themeIndex = 0 }) {
  const COLORS = themes[themeIndex] || {};
  return (
    <div
      className="w-[730px] h-[365px] ml-13 flex items-center justify-center border"
      style={{ borderColor: COLORS.TEXT }}
    >
      <div
        className="pt-0.5 text-base text-start overflow-y-auto h-full scrollbar-none"
        style={{ color: COLORS.TEXT }}
      >
        <p className="mb-3">
          When you click the Airs icon, the current tab is added to Airs. To add
          another tab, open that tab, then click the Airs icon again.
        </p>
        <h3 className="text-2xl font-bold">EQ</h3>
        <p className="mb-3">
          The movable dots each represent a filter used to equalize (or EQ) the
          audio. Filters allow you to boost or lower certain frequencies (i.e.
          just part of the treble or bass). The red dots act as shelf filters
          while the white dots act as notch filters.
        </p>
        <p className="mb-3">
          Moving a dot left or right selects lower or higher frequencies, while
          moving a dot up or down increases or decreases the volume of those
          frequencies. Shift-dragging a filter up and down will widen or narrow
          the filter, also called changing its Q value.
        </p>

        <p className="mb-3">
          The frequency spectrum visualizer shows you what you are listening to
          and how your EQ has changed it. Lower sounds appear to the left and
          higher to the right (with volume indicated by the height of a peak).{" "}
          <a
            href="https://www.youtube.com/watch?v=VMnkYTan5pY"
            rel="noreferrer noopener"
            target="_blank"
          >
            <u>Watch the demo</u>
          </a>
          .
        </p>
        <h3 className="text-2xl font-bold">Presets</h3>
        <p className="mb-3">
          To save a configuration of filters for later, type a name in the text
          box below, then click 'Save Preset' or press ENTER. The save and
          delete buttons operate on whichever preset's name is selected in the
          text box.
        </p>
      </div>
    </div>
  );
}
