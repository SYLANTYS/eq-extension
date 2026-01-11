export default function ActiveTabs() {
  return (
    <div className="w-[730px] h-[365px] ml-13 flex items-center justify-center">
      <div className="w-100 text-sm">
        <div className="flex gap-2 mb-1 items-center">
          <button className="flex items-center gap-1 px-1.5 cursor-pointer border border-eq-yellow rounded-xs hover:text-eq-blue hover:bg-eq-yellow">
            <p>Stop EQing</p>
            <div className="w-4 h-4"></div>
          </button>

          <p className="flex-1 truncate">
            Childish Gambino - This is America (Official Audio)
          </p>
        </div>
        <div className="flex gap-2 mb-1 items-center">
          <button className="flex items-center gap-1 px-1.5 cursor-pointer border border-eq-yellow rounded-xs hover:text-eq-blue hover:bg-eq-yellow">
            <p>Stop EQing</p>
            <div className="w-4 h-4"></div>
          </button>

          <p className="flex-1 truncate">
            Childish Gambino - This is America (Official Audio)
          </p>
        </div>
      </div>
    </div>
  );
}
