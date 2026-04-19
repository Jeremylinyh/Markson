import MarkdownIt from 'markdown-it';
import markdownItKatex from '@vscode/markdown-it-katex';
import hljs from 'highlight.js';

// 1. Initialize the parser. 
// The highlight function should ONLY return the raw, highlighted inner string.
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch (__) {}
    }
    return ''; // Return empty string so markdown-it uses its default escaping fallback
  }
}).use(markdownItKatex);

// 2. Override the fence renderer to inject your custom container, button, and labels.
md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];
  // Extract the language string
  const lang = token.info ? token.info.trim().split(/\s+/)[0] : '';
  
  let highlighted;
  if (options.highlight) {
    // Call the highlight function we defined above
    highlighted = options.highlight(token.content, lang, '') || md.utils.escapeHtml(token.content);
  } else {
    highlighted = md.utils.escapeHtml(token.content);
  }

  // Build the UI elements
  const langLabel = lang ? `<span class="lang-label">${lang}</span>` : '';
  const langAttr = lang ? ` data-lang="${lang}"` : '';
  
  // Return your full HTML structure
  // The <pre> and <code> tags remain mashed together to prevent internal whitespace!
  return `<div class="code-block-container"${langAttr}>
  ${langLabel}
  <button class="copy-btn" onclick="copyCode(this)" title="Copy code">📋</button>
  <pre class="hljs"><code>${highlighted}</code></pre>
</div>\n`;
};

/**
 * Converts a Markdown string with LaTeX into rendered HTML.
 * @param {string} markdownString - The input markdown text.
 * @returns {string} The rendered HTML string.
 */
export function renderMarkdownWithLatex(markdownString: string): string {
  if (!markdownString) { return ''; }
  return md.render(markdownString);
}
