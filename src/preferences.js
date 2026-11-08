// Display choices only. Never change account amounts or gauge rules here.
export const displayDefaults = Object.freeze({
  theme: 'light', font: 'default', view: 'simple', advancedMode: false,
  textSize: 'normal', spacing: 'standard', reduceMotion: false,
});
const key = 'credit-guard-personalisation-v1';

export function normaliseDisplayPreferences(value, theme = 'light') {
  const input = value && typeof value === 'object' ? value : {};
  return {
    theme: ['light', 'dark'].includes(input.theme) ? input.theme : theme,
    font: ['default', 'dyslexic'].includes(input.font) ? input.font : 'default',
    view: ['simple', 'detailed'].includes(input.view) ? input.view : 'simple',
    advancedMode: input.advancedMode === true,
    textSize: ['normal', 'large', 'extra-large'].includes(input.textSize) ? input.textSize : 'normal',
    spacing: ['standard', 'comfortable'].includes(input.spacing) ? input.spacing : 'standard',
    reduceMotion: input.reduceMotion === true,
  };
}
export function effectiveDisplayPreferences(value) {
  const preferences = normaliseDisplayPreferences(value);
  return preferences.advancedMode ? preferences : { ...preferences, textSize: 'normal', spacing: 'standard', reduceMotion: false };
}
export function loadDisplayPreferences(storage, systemDark = false) {
  const theme = systemDark ? 'dark' : 'light';
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (saved?.version === 1) return normaliseDisplayPreferences(saved, theme);
    return normaliseDisplayPreferences({
      theme: storage.getItem('credit-guard-theme'),
      font: storage.getItem('credit-guard-font'),
      view: storage.getItem('credit-guard-view'),
    }, theme);
  } catch { return normaliseDisplayPreferences({}, theme); }
}
export function saveDisplayPreferences(storage, preferences) {
  try { storage.setItem(key, JSON.stringify({ version: 1, ...normaliseDisplayPreferences(preferences) })); return true; }
  catch { return false; }
}
