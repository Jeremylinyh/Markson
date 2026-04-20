import * as path from 'path';
import * as vscode from 'vscode';
import * as parser from './parser/parser.js';

interface MarkdownMetadata {
    editorPath: string;
    lineNumber: number;
    startChar: number;
    endChar: number;
}

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let currentMarkdownEditor: vscode.TextEditor | undefined = undefined;
    let currentRawString: string = '';
    let currentEditorPath: string = '';
    let currentEditorLineNum: number = -1;
    let currentEditorStartChar: number = -1;
    let currentEditorEndChar: number = -1;
    
    const extensionUri = context.extensionUri;
    const tempFileMetadata = new Map<string, MarkdownMetadata>();

    // Register the toggle command
    const toggleCommand = vscode.commands.registerCommand('markson.toggleRenderMode', async () => {
        const config = vscode.workspace.getConfiguration('markson');
        const isRendered = config.get<boolean>('rendered', true);
        
        try {
            // Toggle the setting
            await config.update('rendered', !isRendered, vscode.ConfigurationTarget.Global);
            const newMode = !isRendered ? 'rendered (webview)' : 'markdown (.md file)';
            
            // If we have current content, switch the view
            if (currentRawString) {
                if (isRendered) {
                    // Was in rendered mode, now switch to markdown
                    if (currentPanel) {
                        currentPanel.dispose();
                        currentPanel = undefined;
                    }
                    const mdFileInfo = await openMarkdownFile(
                        currentRawString,
                        currentEditorPath,
                        currentEditorLineNum,
                        currentEditorStartChar,
                        currentEditorEndChar,
                        tempFileMetadata,
                        context
                    );
                    if (mdFileInfo) {
                        currentMarkdownEditor = mdFileInfo;
                    }
                } else {
                    // Was in markdown mode, now switch to rendered
                    if (currentMarkdownEditor) {
                        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        currentMarkdownEditor = undefined;
                    }
                    if (!currentPanel) {
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
                        currentPanel.onDidDispose(() => {
                            currentPanel = undefined;
                        }, null, context.subscriptions);
                    }
                    currentPanel.webview.html = getWebviewContent(currentRawString, extensionUri, currentPanel.webview);
                }
            }
            
            vscode.window.showInformationMessage(`Markson mode switched to: ${newMode}`);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to toggle render mode');
        }
    });
    context.subscriptions.push(toggleCommand);
    
    // Listen for markdown file changes to sync back to source
    // const fileChangeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
    //     const metadata = tempFileMetadata.get(event.document.uri.fsPath);
    //     if (metadata && event.document.isDirty) {
    //         // Markdown file was edited, sync back to source JSON
    //         const updatedContent = event.document.getText();
    //         await updateSourceFile(metadata, updatedContent, context);
            
    //         // Update webview if it's open
    //         if (currentPanel) {
    //             currentPanel.webview.html = getWebviewContent(updatedContent, extensionUri, currentPanel.webview);
    //             currentRawString = updatedContent;
    //         }
    //     }
    // });
    // context.subscriptions.push(fileChangeListener);

    // Listen for cursor movement/clicks
    const selectionCheck = vscode.window.onDidChangeTextEditorSelection(async event => {
        const editor = event.textEditor;
        if (!editor || event.selections.length === 0) {return;}

        const selection = event.selections[0];
        if (!selection.isEmpty) {
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

        const stringRegex = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
        let match;

        while ((match = stringRegex.exec(lineText)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;

            if (position.character > start && position.character < end) {
                let rawString = match[0].slice(1, -1);
                const triggers = config.get<string[]>('triggers', ['#', '\\$', '\\\\n']) ?? ['#', '\\$', '\\\\n'];

                const dynamicRegex = new RegExp(triggers.join('|'));

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
                
                currentRawString = rawString;
                currentEditorPath = editor.document.fileName;
                currentEditorLineNum = position.line;
                currentEditorStartChar = start;
                currentEditorEndChar = end;
                
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
                    
                    if (currentMarkdownEditor) {
                        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        currentMarkdownEditor = undefined;
                    }
                } else {
                    // Markdown mode: open .md file with the string content
                    if (currentPanel) {
                        currentPanel.dispose();
                        currentPanel = undefined;
                    }
                    
                    const mdFileInfo = await openMarkdownFile(rawString, editor.document.fileName, position.line, start, end, tempFileMetadata, context);
                    if (mdFileInfo) {
                        currentMarkdownEditor = mdFileInfo;
                    }
                }
                
                break;
            }
        }
    });

    context.subscriptions.push(selectionCheck);
}

async function openMarkdownFile(
    markdownText: string, 
    sourceEditorPath: string,
    lineNumber: number,
    startChar: number,
    endChar: number,
    tempFileMetadata: Map<string, MarkdownMetadata>,
    context: vscode.ExtensionContext
): Promise<vscode.TextEditor | undefined> {
    try {
        const fileName = `markson_${Date.now()}.md`;
        const tempDir = context.globalStorageUri;
        await vscode.workspace.fs.createDirectory(tempDir);
        const fileUri = vscode.Uri.joinPath(tempDir, fileName);
        
        tempFileMetadata.set(fileUri.fsPath, {
            editorPath: sourceEditorPath,
            lineNumber,
            startChar,
            endChar
        });
        
        const encoder = new TextEncoder();
        const data = encoder.encode(markdownText);
        
        await vscode.workspace.fs.writeFile(fileUri, data);
        
        const document = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
        
        return editor;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open markdown file: ${error}`);
        return undefined;
    }
}

// async function updateSourceFile(
//     metadata: MarkdownMetadata,
//     updatedContent: string,
//     context: vscode.ExtensionContext
// ): Promise<void> {
//     try {
//         const sourceUri = vscode.Uri.file(metadata.editorPath);
//         const sourceDoc = await vscode.workspace.openTextDocument(sourceUri);
//         const line = sourceDoc.lineAt(metadata.lineNumber);
//         const lineText = line.text;
        
//         const originalChar = lineText[metadata.startChar];
        
//         // const escapedContent = updatedContent
//         //     .replace(/\\/g, '\\\\')
//         //     .replace(/"/g, '\\"')
//         //     .replace(/\n/g, '\\n')
//         //     .replace(/\t/g, '\\t')
//         //     .replace(/\r/g, '\\r');
//         const escapedContent = JSON.stringify(updatedContent).slice(1, -1);
        
//         const newString = `${originalChar}${escapedContent}${originalChar}`;
        
//         const range = new vscode.Range(
//             new vscode.Position(metadata.lineNumber, metadata.startChar),
//             new vscode.Position(metadata.lineNumber, metadata.endChar)
//         );
        
//         const workspaceEdit = new vscode.WorkspaceEdit();
//         workspaceEdit.replace(sourceUri, range, newString);
//         await vscode.workspace.applyEdit(workspaceEdit);
//         await sourceDoc.save();
//     } catch (error) {
//         vscode.window.showErrorMessage(`Failed to update source file: ${error}`);
//     }
// }

function getWebviewContent(markdownText: string, extensionUri: vscode.Uri, webview: vscode.Webview) {
    const markdown : string = parser.renderMarkdownWithLatex(markdownText);
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

export function deactivate() {}
