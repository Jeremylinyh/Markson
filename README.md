# Markson: LLM & JSON Markdown Editor

Markson is exactly what it sounds like: straightforward, with no hidden behavior. Just Markdown inside JSON. Markdown inside JSON is barely human-readable. Whether you are inspecting LLM API responses, debugging multi-agent tool calls, or dealing with escaped text blobs, Markson makes it painless.

Simply click on any string inside a JSON file (or other specified formats). If the string contains escaped Markdown or LaTeX, Markson instantly opens it in a clean preview or an editable tab. (Whichever you choose with a simple toggle in command pallet)

Works entirely offline, requires no API keys, and is completely unopinionated about your file structure.
## Features

* Live Preview: Click a JSON string containing `\n`, LaTeX or escaped Markdown → instantly opens a beautifully rendered preview.

* Two-Way Editing: Toggle to edit mode! Open the string as a `.md` file, edit the text normally, and Markson will automatically escape and save your changes right back into the raw JSON file. A quick toggle brings you back to a rendered preview in one keystroke.

* Zero Lock-in: You do not need to format your JSON in any specific, proprietary manner. It just works on raw data.

![Video showcasing feature overview](Demos/Demo.gif)

> Tip: You can define exactly which string patterns trigger the preview in your VS Code settings.

## Why use this?

Working with complex JSON payloads often means dealing with:

* AI & LLM API outputs (OpenAI structured outputs, Anthropic, Gemini, if it is API it probably outputs JSON).

* Multi-Agent Systems and complex custom orchestration setup passing deeply nested JSON state trees back and forth.

* Escaped text blobs buried inside code or configuration files.

Instead of copying and pasting into web formatters, or building a temporary UI just to read an AI's response, Markson lets you inspect and iterate directly in your editor. View the raw schema exactly as your application sees it, but read and edit the Markdown inside it without going cross-eyed.
## Extension Settings

This extension contributes the following settings:

* Markson.enable: Enable/disable this extension.

* Markson.triggers: Define which regex patterns or keys activate the preview.

* Markson.suffixes: File types the extension listens to.

* Markson.rendered: If `true`, opens the Markdown as a read-only rendered preview. If `false`, opens as a fully editable `.md` file that syncs back to your JSON.

## Known Issues

None so far. If you find one, or have any suggestions or contributions, please open an issue on GitHub.

## Release Notes

### 0.0.1

Initial release.

### 0.0.2

Added ability to edit the JSON string in a `.md` file with a render toggle.

