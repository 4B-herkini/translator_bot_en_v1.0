const Voice = {
    recognition: null,
    isListening: false,
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),

    start(lang, onResult, onEnd, onError) {
        if (!this.supported) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = lang || "ko-KR";
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        this.recognition.onresult = (event) => {
            let finalTranscript = "";
            let interimTranscript = "";

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }
            onResult(finalTranscript, interimTranscript);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (onEnd) onEnd();
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            if (onError) onError(event.error);
        };

        this.recognition.start();
        this.isListening = true;
    },

    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    },
};
