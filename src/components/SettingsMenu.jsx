import React, { useRef, useState } from 'react';
import { balanceFigures } from '../balanceFigure.js';

function Switch({ name, description, checked, onChange, id }) {
  return (
    <label className="setting" htmlFor={id}>
      <span className="setting-copy"><strong className="setting-title">{name}</strong><small id={`${id}-hint`}>{description}</small></span>
      <input id={id} type="checkbox" role="switch" aria-label={name} aria-describedby={`${id}-hint`} checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export default function SettingsMenu({ preferences, onChange, storageSaved }) {
  const dialog = useRef(null);
  const opener = useRef(null);
  const [open, setOpen] = useState(false);
  const set = (key, value) => onChange({ ...preferences, [key]: value });
  function show() { dialog.current.showModal(); setOpen(true); }
  function close() { dialog.current.close(); }
  function keepFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button, input, select')].filter((control) => !control.disabled);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return (
    <>
      <button ref={opener} className="secondary" aria-haspopup="dialog" aria-expanded={open} aria-controls="settings-panel" onClick={show}>⚙ Settings</button>
      <dialog ref={dialog} id="settings-panel" className="settings-dialog" aria-labelledby="settings-title" aria-describedby="settings-description"
        onKeyDown={keepFocus} onClose={() => { setOpen(false); opener.current?.focus(); }}>
        <div className="settings-heading">
          <div><p className="eyebrow">MAKE IT COMFORTABLE</p><h2 id="settings-title">Your display, your way</h2></div>
          <button type="button" className="secondary settings-close" aria-label="Close settings" onClick={close}>×</button>
        </div>
        <p id="settings-description" className="muted">Choose what helps you read and focus. These choices also apply to CheckoutGuard’s toolbar and checkout popups.</p>
        <section aria-labelledby="everyday-settings-title" className="settings-section">
          <h3 id="everyday-settings-title">Everyday settings</h3>
          <label className="settings-select" htmlFor="setting-balance"><strong>Main balance number</strong>
            <small id="setting-balance-hint" className="muted">Choose the main figure on the website and extension. The gauge always follows your safe limit.</small>
            <select id="setting-balance" aria-describedby="setting-balance-hint" value={preferences.balanceFigure} onChange={(event) => set('balanceFigure', event.target.value)}>
              {balanceFigures.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select>
          </label>
          <Switch id="setting-theme" name="Dark mode" description="Use a darker background with lighter text." checked={preferences.theme === 'dark'} onChange={(on) => set('theme', on ? 'dark' : 'light')} />
          <Switch id="setting-view" name="Detailed view" description="Show extra figures and percentages. Safe to spend stays the same." checked={preferences.view === 'detailed'} onChange={(on) => set('view', on ? 'detailed' : 'simple')} />
          <Switch id="setting-font" name="Dyslexia-friendly font (OpenDyslexic)" description="Try a different letter shape. Choose whichever font feels easier for you." checked={preferences.font === 'dyslexic'} onChange={(on) => set('font', on ? 'dyslexic' : 'default')} />
        </section>
        <section aria-labelledby="advanced-settings-title" className="settings-section settings-advanced">
          <h3 id="advanced-settings-title">A little more control</h3>
          <Switch id="setting-advanced" name="Advanced Mode" description="Choose text size, spacing and motion. Turning this off pauses those choices without forgetting them." checked={preferences.advancedMode} onChange={(on) => set('advancedMode', on)} />
          {preferences.advancedMode ? (
            <div className="advanced-options" id="advanced-options">
              <label className="settings-select" htmlFor="setting-size"><strong>Text size</strong><small className="muted">Make labels, amounts and buttons easier to read.</small>
                <select id="setting-size" value={preferences.textSize} onChange={(event) => set('textSize', event.target.value)}>
                  <option value="normal">Standard</option><option value="large">Larger</option><option value="extra-large">Largest</option>
                </select>
              </label>
              <Switch id="setting-spacing" name="Comfortable spacing" description="Give lines, controls and buttons more breathing room." checked={preferences.spacing === 'comfortable'} onChange={(on) => set('spacing', on ? 'comfortable' : 'standard')} />
              <Switch id="setting-motion" name="Reduce motion" description="Remove decorative animations and transitions. Your device’s reduced-motion preference is always respected." checked={preferences.reduceMotion} onChange={(on) => set('reduceMotion', on)} />
              <div className="settings-example" aria-label="Display preview"><strong>A little space to think.</strong><p>Clear words. Room to read. You can change these settings whenever you like.</p></div>
            </div>
          ) : <p className="settings-advanced-hint muted">Switch on Advanced Mode to see optional reading and focus controls.</p>}
        </section>
        <div className="settings-footer">
          <p role="status">{storageSaved ? 'Saved on this browser. Reset demo keeps your display choices.' : 'Applied for this visit. Browser storage is unavailable, so these choices may not survive refresh.'}</p>
          <button type="button" onClick={close}>Done</button>
        </div>
      </dialog>
    </>
  );
}
