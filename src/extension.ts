import * as path from 'path';
import * as vscode from 'vscode';
import * as parser from './parser/parser.js';

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let currentMarkdownEditor: vscode.TextEditor | undefined = undefined;
    let currentRawString: string = '';
    const extensionUri = context.extensionUri;

    // Register the toggle command
    const toggleCommand = vscode.commands.registerCommand('markson.toggleRenderMode', async () => {
        const config = vscode.workspace.getConfiguration('markson');
        const isRendered = config.get<boolean>('rendered', true);
        
        try {
            await config.update('rendered', !isRendered, vscode.ConfigurationTarget.Global);
            const newMode = !isRendered ? 'rendered (webview)' : 'markdown (.md file)';
            vscode.window.showInformationMessage(`Markson mode switched to: ${newMode}`);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to toggle render mode');
        }
    });
    context.subscriptions.push(toggleCommand);

    // Listen for cursor movement/clicks
    const selectionCheck = vscode.window.onDidChangeTextEditorSelection(async event => {
        const editor = event.textEditor;
        if (!editor || event.selections.length === 0) {return;}

        // If the selection is NOT empty, the user is highlighting text.
        const selection = event.selections[0];
        if (!selection.isEmpty) {
            // Do nothing
            return;
        }

        const config = vscode.workspace.getConfiguration('markson');
        const isEnabled = config.get<boolean>('enable', true);
        if (!isEnabled) {
            if (currentPanel) {
                currentPanel.dispose();
            }
            return;
        }

        const suffixes = config.get<string[]>('suffixes', ['json', 'jsonc']);
        const fileSuffix = path.extname(editor.document.fileName).replace(/^\./, '').toLowerCase();
        if (!fileSuffix || !suffixes.map(s => s.toLowerCase()).includes(fileSuffix)) {
            if (currentPanel) {
                currentPanel.dispose();
            }
            return;
        }

        const position = event.selections[0].active;
        const lineText = editor.document.lineAt(position.line).text;

        // Regex to catch strings in single, double, or backticks
        const stringRegex = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
        let match;

        while ((match = stringRegex.exec(lineText)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;

            // Check if cursor is inside the string bounds
            if (position.character > start && position.character < end) {
                // Strip the surrounding quotes
                let rawString = match[0].slice(1, -1);
                // console.log(rawString);
                const triggers = config.get<string[]>('triggers', ['#', '\\$', '\\\\n']) ?? ['#', '\\$', '\\\\n'];

                // Join them into a dynamic regex.
                const dynamicRegex = new RegExp(triggers.join('|'));

                // Test the raw string against the user's triggers
                if (!dynamicRegex.test(rawString)) {
                    if (currentPanel) {
                        // currentPanel.dispose();
                    }
                    else {
                        return;
                    }
                }

                rawString = rawString.replace(/\\(n|t|r|"|'|\\)/g, (fullMatch, char) => {
                    switch (char) {
                        case 'n': return '\n';
                        case 't': return '\t';
                        case 'r': return '\r';
                        case '"': return '"';
                        case "'": return "'";
                        case '\\': return '\\';
                        default: return fullMatch;
                    }
                });
                
                // Store the current raw string for toggle command
                currentRawString = rawString;
                
                const isRendered = config.get<boolean>('rendered', true);
                
                if (isRendered) {
                    // Rendered mode: show webview
                    
                    if (currentPanel) {
                        currentPanel.webview.html = getWebviewContent(rawString, extensionUri, currentPanel.webview);
                        currentPanel.reveal(vscode.ViewColumn.Beside, true);
                    } else {
                        currentPanel = vscode.window.createWebviewPanel(
                            'markdown',
                            'Markdown Preview',
                            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                            { 
                                enableScripts: true,
                                localResourceRoots: [
                                    vscode.Uri.joinPath(extensionUri, 'src'),
                                    vscode.Uri.joinPath(extensionUri, 'node_modules', 'katex', 'dist')
                                ]
                            }
                        );
                        currentPanel.webview.html = getWebviewContent(rawString, extensionUri, currentPanel.webview);
                        currentPanel.onDidDispose(() => {
                            currentPanel = undefined;
                        }, null, context.subscriptions);
                    }
                } else {
                    // Markdown mode: open .md file with the string content
                    if (currentPanel) {
                        currentPanel.dispose();
                        currentPanel = undefined;
                    }
                    
                    await openMarkdownFile(rawString, context);
                }
                
                break; // Found our string, stop looping
            }
        }
    });

    context.subscriptions.push(selectionCheck);
}

// Helper to open markdown string in a .md file
async function openMarkdownFile(markdownText: string, context: vscode.ExtensionContext) {
    try {
        const fileName = `markson_${Date.now()}.md`;
        const tempDir = context.globalStorageUri;
        
        // Ensure temp directory exists
        await vscode.workspace.fs.createDirectory(tempDir);
        
        const fileUri = vscode.Uri.joinPath(tempDir, fileName);
        const encoder = new TextEncoder();
        const data = encoder.encode(markdownText);
        
        // Write the markdown string to the file
        await vscode.workspace.fs.writeFile(fileUri, data);
        
        // Open the file in the editor
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open markdown file: ${error}`);
    }
}

// Helper to generate the Webview HTML and render the Markdown
function getWebviewContent(markdownText: string, extensionUri: vscode.Uri, webview: vscode.Webview) {
    //const safeJsonData = JSON.stringify(markdownText).replace(/</g, '\\u003c');
    const markdown : string = parser.renderMarkdownWithLatex(markdownText);
    //console.log(markdown);
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'style.css'));
    const katexStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'katex', 'dist', 'katex.min.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'script.js'));
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <link rel="stylesheet" href="${katexStyleUri}">
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            ${markdown}
        </body>
        <script src="${scriptUri}"></script>
        </html>
    `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
