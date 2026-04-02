const UI = {
    els: {},

    init() {
        this.els = {
            inputText: document.getElementById("input-text"),
            charCount: document.getElementById("char-count"),
            btnTranslate: document.getElementById("btn-translate"),
            btnMic: document.getElementById("btn-mic"),
            voiceLangToggle: document.getElementById("voice-lang-toggle"),
            normalizedCard: document.getElementById("normalized-card"),
            normalizedText: document.getElementById("normalized-text"),
            translationsGrid: document.getElementById("translations-grid"),
            textProfessional: document.getElementById("text-professional"),
            textFriendly: document.getElementById("text-friendly"),
            textConcise: document.getElementById("text-concise"),
            historyPanel: document.getElementById("history-panel"),
            historyList: document.getElementById("history-list"),
            historySearch: document.getElementById("history-search"),
            historyBadge: document.getElementById("history-badge"),
            panelOverlay: document.getElementById("panel-overlay"),
            settingsModal: document.getElementById("settings-modal"),
            apiKeyInput: document.getElementById("api-key-input"),
        };
    },

    updateCharCount(count, max) {
        this.els.charCount.textContent = `${count.toLocaleString()} / ${max.toLocaleString()}`;
        this.els.charCount.classList.toggle("over-limit", count > max);
    },

    setTranslating(active) {
        this.els.btnTranslate.disabled = active;
        this.els.btnTranslate.textContent = active ? "번역 중..." : "번역하기";
        this.els.inputText.disabled = active;
    },

    clearResults() {
        this.els.normalizedText.textContent = "";
        this.els.textProfessional.textContent = "";
        this.els.textFriendly.textContent = "";
        this.els.textConcise.textContent = "";
        this.els.normalizedCard.classList.add("hidden");
        this.els.translationsGrid.classList.add("hidden");
        this._removeStreaming();
    },

    showNormalizedCard() {
        this.els.normalizedCard.classList.remove("hidden");
        this.els.normalizedCard.classList.add("streaming");
    },

    appendNormalization(token) {
        this.els.normalizedText.textContent += token;
    },

    finishNormalization(fullText) {
        this.els.normalizedText.textContent = fullText;
        this.els.normalizedCard.classList.remove("streaming");
    },

    showTranslationsGrid() {
        this.els.translationsGrid.classList.remove("hidden");
        document.querySelectorAll(".tone-card").forEach((el) => el.classList.add("streaming"));
    },

    appendTranslation(tone, token) {
        const el = this._getToneEl(tone);
        if (el) el.textContent += token;
    },

    finishTranslations(data) {
        if (data.professional) this.els.textProfessional.textContent = data.professional;
        if (data.friendly) this.els.textFriendly.textContent = data.friendly;
        if (data.concise) this.els.textConcise.textContent = data.concise;
        this._removeStreaming();
    },

    showError(message) {
        this.clearResults();
        this.els.normalizedCard.classList.remove("hidden");
        this.els.normalizedCard.classList.remove("streaming");
        this.els.normalizedText.textContent = message;
        this.els.normalizedText.style.color = "var(--accent-danger)";
        setTimeout(() => {
            this.els.normalizedText.style.color = "";
        }, 5000);
    },

    // History panel
    toggleHistoryPanel(show) {
        const open = show !== undefined ? show : !this.els.historyPanel.classList.contains("open");
        this.els.historyPanel.classList.toggle("hidden", false);
        // Force reflow before adding open class
        if (open) this.els.historyPanel.offsetHeight;
        this.els.historyPanel.classList.toggle("open", open);
        this.els.panelOverlay.classList.toggle("hidden", !open);
        this.els.panelOverlay.classList.toggle("open", open);
    },

    renderHistoryList(entries) {
        if (entries.length === 0) {
            this.els.historyList.innerHTML = '<div class="history-empty">히스토리가 없습니다</div>';
            return;
        }
        this.els.historyList.innerHTML = entries
            .map(
                (entry) => `
            <div class="history-item" data-id="${entry.id}">
                <div class="history-item__input">${this._escapeHtml(entry.input.slice(0, 60))}</div>
                <div class="history-item__meta">
                    <span class="history-item__time">${History.formatTime(entry.timestamp)}</span>
                    <button class="history-item__delete" data-delete-id="${entry.id}">삭제</button>
                </div>
            </div>`
            )
            .join("");
    },

    updateHistoryBadge(count) {
        this.els.historyBadge.textContent = count;
        this.els.historyBadge.classList.toggle("hidden", count === 0);
    },

    loadHistoryEntry(entry) {
        this.els.inputText.value = entry.input;
        this.els.normalizedCard.classList.remove("hidden");
        this.els.normalizedText.textContent = entry.normalized || "";
        this.els.translationsGrid.classList.remove("hidden");
        this.els.textProfessional.textContent = entry.professional || "";
        this.els.textFriendly.textContent = entry.friendly || "";
        this.els.textConcise.textContent = entry.concise || "";
        this._removeStreaming();
        this.toggleHistoryPanel(false);
    },

    // Settings modal
    toggleSettings(show) {
        this.els.settingsModal.classList.toggle("hidden", !show);
    },

    // Voice
    showVoiceUI() {
        this.els.btnMic.classList.remove("hidden");
        this.els.voiceLangToggle.classList.remove("hidden");
    },

    setRecording(active) {
        this.els.btnMic.classList.toggle("recording", active);
    },

    // Internal
    _getToneEl(tone) {
        const map = {
            professional: this.els.textProfessional,
            friendly: this.els.textFriendly,
            concise: this.els.textConcise,
        };
        return map[tone] || null;
    },

    _removeStreaming() {
        document.querySelectorAll(".streaming").forEach((el) => el.classList.remove("streaming"));
    },

    _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    },
};
