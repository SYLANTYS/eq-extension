import { getDefaultEqValues } from "./eqStateUtils.js";

export function convertImportedPresets(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Preset file must contain an object");
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    throw new Error("Preset file is empty");
  }

  return entries.map(([name, preset], presetIndex) => {
    if (!name.trim() || !preset || typeof preset !== "object") {
      throw new Error("Invalid preset entry");
    }

    const { frequencies, gains, qs } = preset;
    if (
      !Array.isArray(frequencies) ||
      !Array.isArray(gains) ||
      !Array.isArray(qs)
    ) {
      throw new Error(
        `Preset "${name}" must contain frequency, gain, and Q arrays`,
      );
    }

    const length = frequencies.length;
    if (
      (length !== 11 && length !== 13) ||
      gains.length !== length ||
      qs.length !== length
    ) {
      throw new Error(
        `Preset "${name}" must contain matching 11- or 13-item arrays`,
      );
    }

    if (![...frequencies, ...gains, ...qs].every(Number.isFinite)) {
      throw new Error(`Preset "${name}" contains a non-numeric value`);
    }

    const {
      completeGainValues,
      completeFreqValues,
      completeBaseQValues,
    } = getDefaultEqValues();
    const indexOffset = length === 11 ? 2 : 0;

    for (let sourceIndex = 0; sourceIndex < length; sourceIndex++) {
      const targetIndex = sourceIndex + indexOffset;
      const q = qs[sourceIndex];
      const defaultBaseQ =
        targetIndex === 2 || targetIndex === 12 ? 0.75 : 0.3;

      completeFreqValues[targetIndex] = Math.max(
        1,
        Math.min(21500, frequencies[sourceIndex]),
      );
      completeGainValues[targetIndex] = Math.max(
        -30,
        Math.min(30, gains[sourceIndex]),
      );
      completeBaseQValues[targetIndex] =
        q >= 0.707 && q <= 0.7071 ? defaultBaseQ : q;
    }

    return {
      name,
      nodeGainValues: completeGainValues,
      nodeFrequencyValues: completeFreqValues,
      nodeBaseQValues: completeBaseQValues,
      timestamp: Date.now() + presetIndex,
    };
  });
}
