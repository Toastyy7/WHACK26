/**
 * CheckoutGuard - Popup Controller
 * Synchronizes user budget and friction preferences with chrome.storage.local.
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEFAULTS = {
    isEnabled: true,
    monthlyBudget: 300,
    currentSpent: 120,
    cooldownSeconds: 15,
  };

  const guardToggle = document.getElementById("guardToggle");
  const monthlyBudgetInput = document.getElementById("monthlyBudget");
  const currentSpentInput = document.getElementById("currentSpent");
  const cooldownSelect = document.getElementById("cooldownSeconds");
  const remainingAmountEl = document.getElementById("remainingAmount");
  const percentDisplayEl = document.getElementById("percentDisplay");
  const budgetProgressEl = document.getElementById("budgetProgress");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusToast = document.getElementById("statusToast");
  const budgetStatus = document.getElementById("budgetStatus");
  let toastTimer;

  function readAmounts() {
    const inputs = [monthlyBudgetInput, currentSpentInput];
    const valid = inputs.map((input) => {
      const valid = input.value !== "" && input.checkValidity();
      input.setAttribute("aria-invalid", String(!valid));
      return valid;
    });
    return valid.every(Boolean)
      ? [monthlyBudgetInput.valueAsNumber, currentSpentInput.valueAsNumber]
      : null;
  }

  /**
   * Calculate remaining budget and update the visual gauge.
   */
  function updateUI(budget, spent) {
    const budgetPence = Math.round(budget * 100);
    const spentPence = Math.round(spent * 100);
    const remaining = Math.max(0, budgetPence - spentPence) / 100;
    const percent = (spentPence / budgetPence) * 100;

    remainingAmountEl.textContent = `£${remaining.toFixed(2)}`;
    percentDisplayEl.textContent = `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(percent)}% spent`;
    budgetProgressEl.style.width = `${Math.min(100, percent)}%`;

    if (spentPence > budgetPence) {
      budgetProgressEl.style.backgroundColor = "#ef4444";
      budgetStatus.textContent = `£${((spentPence - budgetPence) / 100).toFixed(2)} over your budget.`;
    } else if (percent >= 80) {
      budgetProgressEl.style.backgroundColor = "#f59e0b";
      budgetStatus.textContent = "Approaching spending limit.";
    } else {
      budgetProgressEl.style.backgroundColor = "#15803d";
      budgetStatus.textContent = "Within your budget.";
    }
  }

  function previewAmounts() {
    const amounts = readAmounts();
    if (amounts) {
      updateUI(...amounts);
    } else {
      remainingAmountEl.textContent = "—";
      percentDisplayEl.textContent = "Check amounts";
      budgetProgressEl.style.width = "0%";
      budgetStatus.textContent = "Enter a budget of at least £0.01 and a non-negative spend, with up to two decimal places.";
    }
    return amounts;
  }

  function applySettings(data) {
    guardToggle.checked = data.isEnabled;
    monthlyBudgetInput.value = data.monthlyBudget;
    currentSpentInput.value = data.currentSpent;
    cooldownSelect.value = data.cooldownSeconds;
    previewAmounts();
  }

  /**
   * Load stored settings or populate defaults.
   */
  function loadSettings() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      // Running standalone/preview mode
      applySettings(DEFAULTS);
      return;
    }

    chrome.storage.local.get(DEFAULTS, (data) => {
      applySettings(data);
    });
  }

  /**
   * Save form values to chrome.storage.local.
   */
  function saveSettings() {
    const amounts = previewAmounts();
    if (!amounts) {
      monthlyBudgetInput.reportValidity();
      currentSpentInput.reportValidity();
      return;
    }
    const [budget, spent] = amounts;
    const cooldown = parseInt(cooldownSelect.value, 10) || DEFAULTS.cooldownSeconds;
    const isEnabled = guardToggle.checked;

    const payload = {
      isEnabled,
      monthlyBudget: budget,
      currentSpent: spent,
      cooldownSeconds: cooldown,
    };

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(payload, () => {
        if (chrome.runtime.lastError) {
          showToast("Could not save settings. Please try again.");
          return;
        }
        updateUI(budget, spent);
        showToast("Settings saved successfully!");
      });
    } else {
      updateUI(budget, spent);
      showToast("Preview updated (not saved)");
    }
  }

  /**
   * Reset demonstration figures.
   */
  function resetDemo() {
    monthlyBudgetInput.value = DEFAULTS.monthlyBudget;
    currentSpentInput.value = DEFAULTS.currentSpent;
    cooldownSelect.value = 10; // set to 10s for fast live demos
    guardToggle.checked = true;
    saveSettings();
  }

  function showToast(msg) {
    statusToast.textContent = msg;
    statusToast.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      statusToast.style.display = "none";
    }, 2000);
  }

  // Live input calculation
  monthlyBudgetInput.addEventListener("input", previewAmounts);
  currentSpentInput.addEventListener("input", previewAmounts);

  saveBtn.addEventListener("click", saveSettings);
  resetBtn.addEventListener("click", resetDemo);
  guardToggle.addEventListener("change", saveSettings);

  // Initialize
  loadSettings();
});
