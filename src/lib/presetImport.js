import { getDefaultEqValues } from "./eqStateUtils.js";

function isValueObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function copyNativeValues(values, defaults, presetName, fieldName) {
  if (!isValueObject(values)) {
    throw new Error(`Preset "${presetName}" has an invalid ${fieldName}`);
  }

  const copiedValues = { ...defaults };
  for (const [index, value] of Object.entries(values)) {
    if (!/^(?:[0-9]|1[0-2])$/.test(index) || !Number.isFinite(value)) {
      throw new Error(
        `Preset "${presetName}" has an invalid ${fieldName} value`,
      );
    }
    copiedValues[index] = value;
  }

  return copiedValues;
}

function convertNativePresets(data) {
  if (data.length === 0) {
    throw new Error("Preset file is empty");
  }

  const presetNames = new Set();

  return data.map((preset, presetIndex) => {
    if (
      !isValueObject(preset) ||
      typeof preset.name !== "string" ||
      !preset.name.trim()
    ) {
      throw new Error("Invalid Airs preset entry");
    }

    if (presetNames.has(preset.name)) {
      throw new Error(`Duplicate preset name "${preset.name}"`);
    }
    presetNames.add(preset.name);

    const hasTimestamp = Object.prototype.hasOwnProperty.call(
      preset,
      "timestamp",
    );
    if (hasTimestamp && !Number.isFinite(preset.timestamp)) {
      throw new Error(`Preset "${preset.name}" has an invalid timestamp`);
    }

    const {
      completeGainValues,
      completeFreqValues,
      completeBaseQValues,
    } = getDefaultEqValues();

    return {
      name: preset.name,
      nodeGainValues: copyNativeValues(
        preset.nodeGainValues,
        completeGainValues,
        preset.name,
        "gain",
      ),
      nodeFrequencyValues: copyNativeValues(
        preset.nodeFrequencyValues,
        completeFreqValues,
        preset.name,
        "frequency",
      ),
      nodeBaseQValues: copyNativeValues(
        preset.nodeBaseQValues,
        completeBaseQValues,
        preset.name,
        "base Q",
      ),
      timestamp: hasTimestamp ? preset.timestamp : Date.now() + presetIndex,
    };
  });
}

function convertOnlinePresets(data) {
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

export function convertImportedPresets(data) {
  return Array.isArray(data)
    ? convertNativePresets(data)
    : convertOnlinePresets(data);
}
