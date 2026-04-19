function copyCode(button) {
    const container = button.parentElement;
    const codeElement = container.querySelector('code');
    const codeText = codeElement.textContent || codeElement.innerText;
    
    navigator.clipboard.writeText(codeText).then(() => {
        // Temporarily change button text to indicate success
        const originalText = button.textContent;
        button.textContent = '✓';
        button.style.background = 'var(--vscode-notificationsInfoIcon-foreground)';
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 1000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}