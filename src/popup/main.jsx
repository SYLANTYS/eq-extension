import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";

function Popup() {
  return (
    <div className="w-72 p-4">
      <div className="text-lg font-bold">EQ</div>
      <div className="text-sm text-gray-400">Popup running</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Popup />);
