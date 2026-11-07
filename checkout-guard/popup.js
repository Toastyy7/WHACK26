document.addEventListener('DOMContentLoaded', () => {
  const guard = globalThis.CheckoutGuard;
  const find = (id) => document.getElementById(id);
  const form = find('settingsForm');
  const fields = find('settingsFields');
  const toggle = find('guardToggle');
  const budgetInput = find('monthlyBudget');
  const spentInput = find('currentSpent');
  const cooldown = find('cooldownSeconds');
  let saved = { ...guard.defaults };
  let dirty = false;
  let busy = false;

  function notice(message, error = false) {
    find('statusToast').textContent = message;
    find('statusToast').dataset.kind = error ? 'error' : 'info';
  }
  function enabledLabel() {
    find('guardStatus').textContent = toggle.checked ? 'Guard on' : 'Guard off';
  }
  function readAmounts() {
    const valid = [budgetInput, spentInput].map((input) => {
      input.setCustomValidity('');
      if (input.value && guard.pence(input.value) === null) input.setCustomValidity('Use pounds with up to two decimal places.');
      const valid = input.checkValidity();
      input.setAttribute('aria-invalid', String(!valid));
      return valid;
    });
    return valid.every(Boolean) ? {
      isEnabled: toggle.checked,
      monthlyBudget: guard.pence(budgetInput.value) / 100,
      currentSpent: guard.pence(spentInput.value) / 100,
      cooldownSeconds: Number(cooldown.value),
    } : null;
  }
  function preview() {
    const settings = readAmounts();
    const meter = find('budgetMeter');
    if (!settings) {
      find('remainingAmount').textContent = '—';
      find('percentDisplay').textContent = 'Check amounts';
      find('budgetStatus').textContent = 'Enter a positive budget and a non-negative spend, with up to two decimal places.';
      find('budgetProgress').style.width = '0%';
      meter.setAttribute('aria-valuenow', '0');
      meter.setAttribute('aria-valuetext', 'Enter valid amounts to calculate budget usage.');
      return null;
    }
    const result = guard.impact(settings);
    find('remainingAmount').textContent = guard.money(result.remaining);
    find('percentDisplay').textContent = `${guard.percent(result.percentage)} spent`;
    find('budgetStatus').textContent = result.label;
    find('budgetProgress').style.width = `${result.width}%`;
    find('budgetProgress').dataset.zone = result.zone;
    meter.setAttribute('aria-valuenow', String(result.width));
    meter.setAttribute('aria-valuetext', `${guard.percent(result.percentage)} spent. ${result.label}`);
    return settings;
  }
  function apply(settings) {
    toggle.checked = settings.isEnabled;
    budgetInput.value = settings.monthlyBudget;
    spentInput.value = settings.currentSpent;
    if (![...cooldown.options].some((option) => Number(option.value) === settings.cooldownSeconds)) cooldown.add(new Option(`${settings.cooldownSeconds} seconds`, String(settings.cooldownSeconds)));
    cooldown.value = String(settings.cooldownSeconds);
    enabledLabel();
    preview();
  }
  function setBusy(value) {
    busy = value;
    fields.disabled = value;
    toggle.disabled = value;
  }
  async function load() {
    setBusy(true);
    find('retryLoad').hidden = true;
    try {
      saved = guard.available() ? await guard.load() : { ...guard.defaults };
      apply(saved);
      dirty = false;
      notice(guard.available() ? 'Settings stay in this browser. Purchases are not recorded automatically.' : 'Preview mode · settings are not saved.');
      setBusy(false);
    } catch {
      notice('Could not load your saved settings. Retry before making changes.', true);
      find('retryLoad').hidden = false;
    }
  }
  async function save(settings) {
    if (busy) return;
    setBusy(true);
    try {
      if (guard.available()) await guard.save(settings);
      saved = { ...settings };
      dirty = false;
      apply(saved);
      notice(guard.available() ? 'Settings saved. Open checkout previews update automatically.' : 'Preview updated (not saved).');
    } catch {
      dirty = true;
      notice('Could not save settings. Your changes are here; please try again.', true);
    } finally { setBusy(false); }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const settings = preview();
    if (settings) save(settings);
    else form.reportValidity();
  });
  form.addEventListener('input', () => {
    dirty = true;
    preview();
    notice('Preview only · save changes to apply them to checkouts.');
  });
  toggle.addEventListener('change', async () => {
    const desired = toggle.checked;
    setBusy(true);
    try {
      if (guard.available()) await guard.setEnabled(desired);
      saved.isEnabled = desired;
      notice(guard.available() ? (desired ? 'Guard enabled.' : 'Guard disabled. Open checkout previews are closed.') : 'Preview mode · settings are not saved.');
    } catch {
      toggle.checked = saved.isEnabled;
      notice('Could not update the guard. Please try again.', true);
    } finally { enabledLabel(); setBusy(false); }
  });
  find('resetBtn').addEventListener('click', () => save({ ...guard.defaults }));
  find('retryLoad').addEventListener('click', load);
  guard.subscribe(async () => {
    if (busy) return;
    try {
      const settings = await guard.load();
      saved = settings;
      toggle.checked = settings.isEnabled;
      enabledLabel();
      if (!dirty) apply(settings);
    } catch { notice('Could not read updated settings. Your edits are still here.', true); }
  });
  load();
});
