// src/popup/hooks/useNodeDrag.js
// Hook for managing EQ node drag interactions.
// Handles normal drag (frequency/gain) and shift+drag (Q adjustment).

import { useState, useRef, useEffect, useCallback } from "react";
import {
  DEFAULT_PEAKING_Q,
  DEFAULT_SHELF_Q,
  calculateQ,
  isShelfFilter,
} from "../../lib/qCalculations.js";
import {
  SVG_HEIGHT,
  CENTER_Y,
  getBaseXPos,
  getFrequencyFromXPos,
} from "../../lib/svgCoordinateSystem.js";

/**
 * Hook for EQ node drag behavior.
 *
 * @param {Object} options
 * @param {React.RefObject} options.svgRef - Ref to the SVG element
 * @param {number[]} options.frequencies - Frequency band array
 * @param {Object} options.nodePositions - Current node positions
 * @param {Object} options.nodeGainValues - Current gain values
 * @param {Object} options.nodeFrequencyValues - Current frequency values
 * @param {Object} options.nodeQValues - Current Q values
 * @param {Object} options.nodeBaseQValues - Current base Q values
 * @param {Function} options.onEqNodesChange - Callback when EQ values change
 * @param {Function} options.onEnsureBackend - Callback to ensure backend is ready
 * @returns {{ draggingNode: number|null, handleNodeMouseDown: Function }}
 */
export function useNodeDrag({
  svgRef,
  frequencies,
  nodePositions,
  nodeGainValues,
  nodeFrequencyValues,
  nodeQValues,
  nodeBaseQValues,
  onEqNodesChange,
  onEnsureBackend,
}) {
  const [draggingNode, setDraggingNode] = useState(null);
  const [isShiftDrag, setIsShiftDrag] = useState(false);
  const shiftDragStartYRef = useRef(null);

  /**
   * Initiate node drag
   */
  const handleNodeMouseDown = useCallback(
    (index, e) => {
      e.preventDefault();
      onEnsureBackend?.();
      setDraggingNode(index);
      setIsShiftDrag(e.shiftKey);
      if (e.shiftKey) {
        // For shift drag, capture starting Y position
        const svg = svgRef.current;
        if (svg) {
          const rect = svg.getBoundingClientRect();
          const svgRect = svg.viewBox.baseVal;
          const scaleY = svgRect.height / rect.height;
          const mouseY = (e.clientY - rect.top) * scaleY;
          shiftDragStartYRef.current = mouseY;
        }
      }
    },
    [svgRef, onEnsureBackend],
  );

  /**
   * Handle mouse move during drag
   * Normal drag: updates node position (frequency/gain)
   * Shift+drag (vertical only): adjusts Q value from 0.1 to 2.0
   */
  const handleMouseMove = useCallback(
    (e) => {
      if (draggingNode === null) return;

      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const svgRect = svg.viewBox.baseVal;

      // Convert screen coordinates to SVG viewBox coordinates
      const scaleX = svgRect.width / rect.width;
      const scaleY = svgRect.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      if (isShiftDrag) {
        // Shift+drag: Adjust base Q value based on vertical movement (0.1 to 2.0)
        const logMin = Math.log(0.1);
        const logMax = Math.log(2.0);
        const logCenter = Math.log(DEFAULT_PEAKING_Q);

        const startY = shiftDragStartYRef.current ?? mouseY;
        const qOffsetRatio = (startY - mouseY) / (SVG_HEIGHT / 3);
        let logQ = logCenter + qOffsetRatio * ((logMax - logMin) / 2);
        let baseQ = Math.exp(logQ);
        baseQ = Math.max(0.1, Math.min(2.0, baseQ));

        // Calculate the new Q value from baseQ and current gain
        const gaindB = nodeGainValues[draggingNode] ?? 0;
        const Q = calculateQ(draggingNode, baseQ, gaindB);

        // Update parent state via callback with both baseQ and new Q value
        const newBaseQValues = {
          ...nodeBaseQValues,
          [draggingNode]: baseQ,
        };
        const newQValues = {
          ...nodeQValues,
          [draggingNode]: Q,
        };
        onEqNodesChange(
          nodePositions,
          nodeGainValues,
          nodeFrequencyValues,
          newQValues,
          newBaseQValues,
        );
        return;
      }

      // Normal drag: update node position (frequency/gain)
      const baseX = getBaseXPos(draggingNode, frequencies);
      const offsetX = mouseX - baseX;
      const offsetY = mouseY - CENTER_Y;
      const currentX = baseX + offsetX;

      // Calculate frequency and gain
      let frequency = getFrequencyFromXPos(currentX, frequencies);
      frequency = Math.max(1, Math.min(21500, frequency));

      let gaindB = -(offsetY / SVG_HEIGHT) * 60;
      gaindB = Math.max(-30, Math.min(30, gaindB));

      const isShelf = isShelfFilter(draggingNode);
      const baseQ =
        nodeBaseQValues[draggingNode] ??
        (isShelf ? DEFAULT_SHELF_Q : DEFAULT_PEAKING_Q);
      const Q = calculateQ(draggingNode, baseQ, gaindB);

      // Update parent state via callback
      const newPositions = {
        ...nodePositions,
        [draggingNode]: { x: offsetX, y: offsetY },
      };
      const newGainValues = {
        ...nodeGainValues,
        [draggingNode]: gaindB,
      };
      const newFrequencyValues = {
        ...nodeFrequencyValues,
        [draggingNode]: frequency,
      };
      const newQValues = {
        ...nodeQValues,
        [draggingNode]: Q,
      };

      onEqNodesChange(
        newPositions,
        newGainValues,
        newFrequencyValues,
        newQValues,
        nodeBaseQValues,
      );
    },
    [
      draggingNode,
      isShiftDrag,
      svgRef,
      frequencies,
      nodePositions,
      nodeGainValues,
      nodeFrequencyValues,
      nodeQValues,
      nodeBaseQValues,
      onEqNodesChange,
    ],
  );

  /**
   * End drag operation
   */
  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
    setIsShiftDrag(false);
    shiftDragStartYRef.current = null;
  }, []);

  /**
   * Attach document-level mouse listeners when dragging
   * Allows dragging to continue outside SVG boundaries
   */
  useEffect(() => {
    if (draggingNode === null) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingNode, handleMouseMove, handleMouseUp]);

  return {
    draggingNode,
    handleNodeMouseDown,
  };
}
