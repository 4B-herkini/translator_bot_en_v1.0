const UI = {
    els: {},

    init() {
        this.els = {
            inputText: document.getElementById("input-text"),
            charCount: document.getElementById("char-count"),
            btnTranslate: document.getElementById("btn-translate"),
            btnMic: document.getElementById("btn-mic"),
            normalizedCard: document.getElementById("normalized-card"),
            normalizedOriginal: document.getElementById("normalized-original"),
            normalizedArrow: document.getElementById("normalized-arrow"),
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
            voiceSection: document.getElementById("voice-section"),
            recordingBar: document.getElementById("recording-bar"),
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
        this.els.normalizedText.innerHTML = "";
        this.els.normalizedOriginal.innerHTML = "";
        this.els.normalizedOriginal.classList.remove("visible");
        this.els.normalizedArrow.classList.remove("visible");
        this.els.textProfessional.textContent = "";
        this.els.textFriendly.textContent = "";
        this.els.textConcise.textContent = "";
        this.els.normalizedCard.classList.add("hidden");
        this.els.translationsGrid.classList.add("hidden");
        this._removeStreaming();
        this._clearReviewBadges();
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

    // --- Normalization Diff (Change 1) ---
    showNormalizationDiff(originalText, normalizedText) {
        const orig = originalText.trim();
        const norm = normalizedText.trim();

        if (orig === norm) {
            this.els.normalizedOriginal.innerHTML = '<span class="diff-clean">입력이 이미 깨끗합니다 ✓</span>';
            this.els.normalizedOriginal.classList.add("visible");
            this.els.normalizedArrow.classList.remove("visible");
            return;
        }

        const diff = this._computeWordDiff(orig, norm);
        this.els.normalizedOriginal.innerHTML = '<span class="diff-label">원본</span> ' + diff.originalHtml;
        this.els.normalizedText.innerHTML = '<span class="diff-label">정제</span> ' + diff.normalizedHtml;

        // Animate reveal
        setTimeout(() => {
            this.els.normalizedOriginal.classList.add("visible");
        }, 200);
        setTimeout(() => {
            this.els.normalizedArrow.classList.add("visible");
        }, 400);
    },

    // --- Voice UI (Change 2) ---
    showVoiceUI() {
        if (this.els.voiceSection) this.els.voiceSection.classList.remove("hidden");
    },

    setRecording(active) {
        if (this.els.voiceSection) this.els.voiceSection.classList.toggle("hidden", active);
        if (this.els.recordingBar) this.els.recordingBar.classList.toggle("hidden", !active);
    },

    // --- Review (Change 3) ---
    showReviewStart() {
        const card = document.getElementById("review-card");
        card.classList.remove("hidden");
        card.classList.add("reviewing");
        document.getElementById("review-label").textContent = "검수 중... (Claude Sonnet)";
        document.getElementById("review-summary").textContent = "";
        document.getElementById("review-changes").textContent = "";
    },

    showReviewDone(review) {
        const card = document.getElementById("review-card");
        card.classList.remove("hidden");
        card.classList.remove("reviewing");
        document.getElementById("review-label").textContent = "검수 완료";
        document.getElementById("review-summary").textContent = review.summary || "수정 없음 — 번역 품질 양호";
        const changesEl = document.getElementById("review-changes");
        if (review.changes && review.changes !== "변경 없음") {
            changesEl.textContent = review.changes;
            changesEl.style.display = "";
        } else {
            changesEl.style.display = "none";
        }
    },

    hideReview() {
        const card = document.getElementById("review-card");
        card.classList.add("hidden");
        card.classList.remove("reviewing");
    },

    // Review inline badges on tone cards
    showReviewBadges(preReview, finalData) {
        const tones = ["professional", "friendly", "concise"];
        tones.forEach((tone) => {
            const origText = (preReview[tone] || "").trim();
            const finalText = (finalData[tone] || "").trim();
            const cardEl = document.querySelector(`.tone-${tone}`);
            if (!cardEl) return;

            const actionsEl = cardEl.querySelector(".result-card__actions");
            if (!actionsEl) return;

            // Remove existing badge
            const existing = actionsEl.querySelector(".review-badge");
            if (existing) existing.remove();

            if (origText && finalText && origText !== finalText) {
                const badge = document.createElement("button");
                badge.className = "btn-sm review-badge";
                badge.textContent = "검수 수정됨";
                badge.dataset.tone = tone;
                badge.dataset.showingRevised = "true";
                actionsEl.prepend(badge);

                cardEl.dataset.originalText = origText;
                cardEl.dataset.revisedText = finalText;

                badge.addEventListener("click", () => {
                    this._toggleReviewDiff(cardEl);
                });
            }
        });
    },

    _toggleReviewDiff(cardEl) {
        const contentEl = cardEl.querySelector(".result-card__content");
        const badge = cardEl.querySelector(".review-badge");
        const isShowingRevised = badge.dataset.showingRevised === "true";

        if (isShowingRevised) {
            const diff = this._computeWordDiff(cardEl.dataset.originalText, cardEl.dataset.revisedText);
            contentEl.innerHTML = diff.combinedHtml;
            badge.textContent = "수정본 보기";
            badge.dataset.showingRevised = "false";
            badge.classList.add("active");
        } else {
            contentEl.textContent = cardEl.dataset.revisedText;
            badge.textContent = "검수 수정됨";
            badge.dataset.showingRevised = "true";
            badge.classList.remove("active");
        }
    },

    _clearReviewBadges() {
        document.querySelectorAll(".review-badge").forEach((el) => el.remove());
    },

    // --- History ---
    toggleHistoryPanel(show) {
        const open = show !== undefined ? show : !this.els.historyPanel.classList.contains("open");
        this.els.historyPanel.classList.toggle("hidden", false);
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

        // Restore normalization diff
        if (entry.input && entry.normalized) {
            this.showNormalizationDiff(entry.input, entry.normalized);
        }

        // Restore review
        if (entry.review) {
            this.showReviewDone(entry.review);
        } else {
            this.hideReview();
        }
        this.toggleHistoryPanel(false);
    },

    toggleSettings(show) {
        this.els.settingsModal.classList.toggle("hidden", !show);
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

    // --- Internal ---
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

    // Word-level diff using LCS
    _computeWordDiff(original, normalized) {
        const splitTokens = (s) => s.match(/\S+|\s+/g) || [];
        const origTokens = splitTokens(original);
        const normTokens = splitTokens(normalized);

        // LCS table
        const m = origTokens.length;
        const n = normTokens.length;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (origTokens[i - 1] === normTokens[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        // Backtrack
        const diff = [];
        let i = m, j = n;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && origTokens[i - 1] === normTokens[j - 1]) {
                diff.unshift({ type: "same", orig: origTokens[i - 1], norm: normTokens[j - 1] });
                i--; j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                diff.unshift({ type: "added", norm: normTokens[j - 1] });
                j--;
            } else {
                diff.unshift({ type: "removed", orig: origTokens[i - 1] });
                i--;
            }
        }

        // Build HTML
        let originalHtml = "";
        let normalizedHtml = "";
        let combinedHtml = "";

        for (const d of diff) {
            if (d.type === "same") {
                const esc = this._escapeHtml(d.orig);
                originalHtml += esc;
                normalizedHtml += esc;
                combinedHtml += esc;
            } else if (d.type === "removed") {
                const esc = this._escapeHtml(d.orig);
                originalHtml += `<del class="diff-removed">${esc}</del>`;
                combinedHtml += `<del class="diff-removed">${esc}</del>`;
            } else if (d.type === "added") {
                const esc = this._escapeHtml(d.norm);
                normalizedHtml += `<ins class="diff-added">${esc}</ins>`;
                combinedHtml += `<ins class="diff-added">${esc}</ins>`;
            }
        }

        return { originalHtml, normalizedHtml, combinedHtml };
    },
};
