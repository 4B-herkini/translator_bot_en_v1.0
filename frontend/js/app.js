const MAX_INPUT = 3000;
let currentResults = null;
let currentProvider = "claude";

document.addEventListener("DOMContentLoaded", () => {
    UI.init();

    // Voice support detection
    if (Voice.supported) {
        UI.showVoiceUI();
    }

    // History badge
    UI.updateHistoryBadge(History.count());

    // --- Event Listeners ---

    // Character count
    UI.els.inputText.addEventListener("input", () => {
        UI.updateCharCount(UI.els.inputText.value.length, MAX_INPUT);
    });

    // Translate button
    UI.els.btnTranslate.addEventListener("click", translate);

    // Ctrl+Enter shortcut
    UI.els.inputText.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            translate();
        }
    });

    // Copy buttons
    document.addEventListener("click", (e) => {
        const copyBtn = e.target.closest(".btn-copy");
        if (copyBtn) {
            const targetId = copyBtn.dataset.target;
            const targetEl = document.getElementById(targetId);
            if (targetEl) Clipboard.copy(targetEl.textContent, copyBtn);
        }
    });

    // Edit normalization
    document.addEventListener("click", (e) => {
        if (e.target.closest(".btn-edit")) {
            const normalized = UI.els.normalizedText.textContent;
            if (normalized) {
                UI.els.inputText.value = normalized;
                UI.updateCharCount(normalized.length, MAX_INPUT);
                UI.els.inputText.focus();
            }
        }
    });

    // Mic button
    UI.els.btnMic.addEventListener("click", toggleVoice);

    // Provider selector
    document.querySelectorAll(".provider-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".provider-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            currentProvider = btn.dataset.provider;
        });
    });

    // Voice language toggle
    document.querySelectorAll(".btn-lang").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".btn-lang").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    // History panel
    document.getElementById("btn-history").addEventListener("click", () => {
        UI.renderHistoryList(History.getAll());
        UI.toggleHistoryPanel();
    });

    document.getElementById("btn-close-history").addEventListener("click", () => {
        UI.toggleHistoryPanel(false);
    });

    UI.els.panelOverlay.addEventListener("click", () => {
        UI.toggleHistoryPanel(false);
    });

    // History search
    UI.els.historySearch.addEventListener("input", (e) => {
        UI.renderHistoryList(History.search(e.target.value));
    });

    // History item click
    UI.els.historyList.addEventListener("click", (e) => {
        const deleteBtn = e.target.closest("[data-delete-id]");
        if (deleteBtn) {
            e.stopPropagation();
            History.deleteEntry(deleteBtn.dataset.deleteId);
            UI.renderHistoryList(History.search(UI.els.historySearch.value));
            UI.updateHistoryBadge(History.count());
            return;
        }

        const item = e.target.closest(".history-item");
        if (item) {
            const entry = History.getAll().find((h) => h.id === item.dataset.id);
            if (entry) UI.loadHistoryEntry(entry);
        }
    });

    // Clear history
    document.getElementById("btn-clear-history").addEventListener("click", () => {
        if (confirm("전체 히스토리를 삭제하시겠습니까?")) {
            History.clearAll();
            UI.renderHistoryList([]);
            UI.updateHistoryBadge(0);
        }
    });

    // Settings
    document.getElementById("btn-settings").addEventListener("click", () => {
        UI.els.apiKeyInput.value = localStorage.getItem("translit_api_key") || "";
        UI.toggleSettings(true);
    });

    document.getElementById("btn-close-settings").addEventListener("click", () => {
        UI.toggleSettings(false);
    });

    document.getElementById("btn-toggle-key").addEventListener("click", () => {
        const input = UI.els.apiKeyInput;
        const btn = document.getElementById("btn-toggle-key");
        if (input.type === "password") {
            input.type = "text";
            btn.textContent = "숨기기";
        } else {
            input.type = "password";
            btn.textContent = "표시";
        }
    });

    document.getElementById("btn-save-settings").addEventListener("click", () => {
        const key = UI.els.apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem("translit_api_key", key);
        } else {
            localStorage.removeItem("translit_api_key");
        }
        UI.toggleSettings(false);
    });

    // Close settings on overlay click
    UI.els.settingsModal.addEventListener("click", (e) => {
        if (e.target === UI.els.settingsModal) {
            UI.toggleSettings(false);
        }
    });
});

async function translate() {
    const text = UI.els.inputText.value.trim();
    if (!text) return;
    if (text.length > MAX_INPUT) return;

    UI.setTranslating(true);
    UI.clearResults();
    UI.hideReview();
    UI.showNormalizedCard();

    let translationsShown = false;
    currentResults = { input: text, normalized: "", professional: "", friendly: "", concise: "" };

    const apiKey = localStorage.getItem("translit_api_key") || "";

    await API.streamTranslation(text, apiKey, currentProvider, {
        onNormalization(token) {
            UI.appendNormalization(token);
        },
        onNormalizationDone(fullText) {
            UI.finishNormalization(fullText);
            currentResults.normalized = fullText;
        },
        onTranslation(tone, token) {
            if (!translationsShown) {
                UI.showTranslationsGrid();
                translationsShown = true;
            }
            UI.appendTranslation(tone, token);
        },
        onReviewStart() {
            UI.showReviewStart();
        },
        onReviewDone(review) {
            UI.showReviewDone(review);
        },
        onDone(data) {
            // If review revised the translations, update the cards
            if (data.professional) UI.els.textProfessional.textContent = data.professional;
            if (data.friendly) UI.els.textFriendly.textContent = data.friendly;
            if (data.concise) UI.els.textConcise.textContent = data.concise;
            UI.finishTranslations(data);
            currentResults = { ...currentResults, ...data };

            // Save to history
            History.save(currentResults);
            UI.updateHistoryBadge(History.count());
        },
        onError(message) {
            UI.showError(message);
        },
    });

    UI.setTranslating(false);
}

function toggleVoice() {
    if (Voice.isListening) {
        Voice.stop();
        UI.setRecording(false);
        return;
    }

    const activeLang = document.querySelector(".btn-lang.active");
    const lang = activeLang ? activeLang.dataset.lang : "ko-KR";

    Voice.start(
        lang,
        (finalText, interimText) => {
            UI.els.inputText.value = finalText + interimText;
            UI.updateCharCount(UI.els.inputText.value.length, MAX_INPUT);
        },
        () => {
            UI.setRecording(false);
        },
        (error) => {
            UI.setRecording(false);
            if (error !== "no-speech") {
                UI.showError("음성 인식 오류: " + error);
            }
        }
    );

    UI.setRecording(true);
}
