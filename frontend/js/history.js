const History = {
    STORAGE_KEY: "translit_history",
    MAX_ENTRIES: 50,

    getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    },

    save(entry) {
        const entries = this.getAll();
        const item = {
            id: "tl_" + Date.now(),
            timestamp: Date.now(),
            ...entry,
        };
        entries.unshift(item);
        if (entries.length > this.MAX_ENTRIES) {
            entries.length = this.MAX_ENTRIES;
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
        return item;
    },

    search(query) {
        if (!query) return this.getAll();
        const q = query.toLowerCase();
        return this.getAll().filter((entry) => {
            return (
                (entry.input && entry.input.toLowerCase().includes(q)) ||
                (entry.normalized && entry.normalized.toLowerCase().includes(q)) ||
                (entry.professional && entry.professional.toLowerCase().includes(q)) ||
                (entry.friendly && entry.friendly.toLowerCase().includes(q)) ||
                (entry.concise && entry.concise.toLowerCase().includes(q))
            );
        });
    },

    deleteEntry(id) {
        const entries = this.getAll().filter((e) => e.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
    },

    clearAll() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    count() {
        return this.getAll().length;
    },

    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "방금 전";
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;
        return new Date(timestamp).toLocaleDateString("ko-KR");
    },
};
