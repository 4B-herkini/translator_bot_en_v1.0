const API = {
    controller: null,

    async streamTranslation(text, apiKey, provider, callbacks) {
        // Cancel previous request
        if (this.controller) {
            this.controller.abort();
        }
        this.controller = new AbortController();

        try {
            const body = { text };
            if (apiKey) body.api_key = apiKey;
            if (provider) body.provider = provider;

            const response = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: this.controller.signal,
            });

            if (!response.ok) {
                callbacks.onError(`서버 오류: ${response.status}`);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop(); // Keep incomplete line

                let eventType = null;
                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith("data: ") && eventType) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            this._dispatch(eventType, data, callbacks);
                        } catch {
                            // Skip malformed data
                        }
                        eventType = null;
                    }
                }
            }
        } catch (err) {
            if (err.name !== "AbortError") {
                callbacks.onError(err.message || "번역 중 오류가 발생했습니다.");
            }
        }
    },

    _dispatch(event, data, callbacks) {
        switch (event) {
            case "normalization":
                callbacks.onNormalization(data.token);
                break;
            case "normalization_done":
                callbacks.onNormalizationDone(data.full_text);
                break;
            case "translation":
                callbacks.onTranslation(data.tone, data.token);
                break;
            case "done":
                callbacks.onDone(data);
                break;
            case "error":
                callbacks.onError(data.message);
                break;
        }
    },

    cancel() {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }
    },
};
