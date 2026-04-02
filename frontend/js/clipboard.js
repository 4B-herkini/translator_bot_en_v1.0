const Clipboard = {
    async copy(text, buttonEl) {
        try {
            await navigator.clipboard.writeText(text);
            const original = buttonEl.textContent;
            buttonEl.textContent = "복사됨!";
            buttonEl.classList.add("copied");
            setTimeout(() => {
                buttonEl.textContent = original;
                buttonEl.classList.remove("copied");
            }, 1500);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
    },
};
