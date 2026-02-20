# LinkSlinger

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Select, open, copy, or bookmark multiple links at once.**

LinkSlinger is a powerful browser extension that streamlines your workflow by allowing you to quickly select and manage multiple links from any webpage using a simple drag-selection interface. Part of the [dontpoke.me](https://dontpoke.me) OSINT toolkit.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## About

LinkSlinger enables rapid link management through an intuitive drag-selection mechanism. Whether you're conducting research, managing bookmarks, or collecting resources, LinkSlinger helps you work faster and more efficiently.

**Built for security researchers, OSINT practitioners, and power users who need to process multiple links quickly.**

### Key Highlights

- 🎯 **Fast Selection** - Drag to select multiple links in seconds
- 🎨 **Modern UI** - Clean, dark-themed interface matching the dontpoke.me design system
- 🔒 **Privacy-Focused** - No external requests, all processing happens locally
- ⚡ **Lightweight** - Minimal resource usage, optimized for performance
- 🔧 **Manifest V3** - Built for modern Chrome browsers

## Features

### Core Functionality

- **Multi-Link Selection** - Select multiple links by dragging a selection box
- **Multiple Actions**:
  - Open links in new tabs
  - Open links in a new window
  - Copy links to clipboard (multiple formats)
  - Bookmark selected links
- **Smart Selection** - Automatically filter out non-relevant links
- **Customizable Hotkeys** - Configure activation keys (Shift, Ctrl/Cmd, Alt)
- **Blocklist Support** - Exclude specific domains from selection

### User Interface

- **Popup Panel** - Quick access to status and settings (320px compact design)
- **Full Options Page** - Comprehensive settings with sidebar navigation
- **Visual Feedback** - Blue selection box with live link counter tooltip
- **Dark Theme** - Professional dark UI matching dontpoke.me aesthetic

## Installation

### From Chrome Web Store

*Coming soon - LinkSlinger will be available on the Chrome Web Store*

### Manual Installation (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/ForestSageSarah/linkclump.git
   cd linkclump
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top-right)

4. Click "Load unpacked" and select the `src` directory

5. LinkSlinger is now installed and ready to use!

## Usage

### Basic Selection

1. Navigate to any webpage with multiple links
2. **Hold Shift** (or your configured activation key) + **Left-click** and **drag** to create a selection box
3. Release the mouse button to perform the default action (open in new tabs)

### Selection Box

- **Blue border** indicates the selection area
- **Tooltip counter** shows the number of links selected in real-time
- Works across page scrolls and different page layouts

### Configuration

Access settings by:
- Clicking the extension icon → Click the ⚙️ settings icon
- Right-click extension icon → Options
- Navigate to `chrome://extensions/` → Find LinkSlinger → Click "Details" → Options

### Settings Available

- **Activation Key** - Choose between Shift, Ctrl/Cmd, or Alt
- **Default Action** - Set what happens when you release the selection
- **Smart Selection** - Enable automatic filtering of non-relevant links
- **Blocklist** - Add domains to exclude from selection

## Development

### Prerequisites

- Chrome/Chromium browser (for testing)
- Basic knowledge of JavaScript, HTML, CSS
- Git (for version control)

### Project Structure

```
src/
├── ui/
│   ├── popup/          # Popup UI (HTML, CSS, JS)
│   └── options/        # Options page (HTML, CSS, JS)
├── styles/
│   └── content.css     # In-page selection box styles
├── assets/
│   ├── icons/          # Extension icons
│   └── fonts/          # Inter font files
├── content.js          # Content script (selection logic)
├── background.js       # Service worker (message handling)
└── manifest.json       # Extension manifest
```

### Building

This project uses a simple build process. To prepare for distribution:

1. Ensure all files are in the `src/` directory
2. Test the extension in Chrome Developer Mode
3. Zip the `src/` directory contents (not the `src` folder itself)
4. Upload to Chrome Web Store Developer Dashboard

### Key Technologies

- **Manifest V3** - Modern Chrome extension architecture
- **Vanilla JavaScript** - No frameworks, lightweight and fast
- **CSS Variables** - Theme system for easy customization
- **Chrome APIs** - Storage, Tabs, Bookmarks, Clipboard

### Code Style

- ES6+ JavaScript
- Consistent naming conventions
- Comprehensive error handling
- Detailed inline comments for complex logic

## Contributing

Contributions are welcome! LinkSlinger is part of the open-source security research community.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Reporting Issues

Found a bug or have a feature request? Please open an issue on GitHub with:
- Clear description of the problem/request
- Steps to reproduce (for bugs)
- Browser version and OS
- Screenshots if applicable

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Original LinkClump** - Built upon the foundation of the original LinkClump extension
- **dontpoke.me** - Part of the dontpoke.me OSINT toolkit ecosystem
- **Open Source Community** - Thanks to all contributors and users

## Links

- **Website**: [dontpoke.me/linkslinger](https://dontpoke.me/linkslinger)
- **GitHub Repository**: [github.com/ForestSageSarah/linkclump](https://github.com/ForestSageSarah/linkclump)
- **Issues**: [GitHub Issues](https://github.com/ForestSageSarah/linkclump/issues)

---

**LinkSlinger** - Part of the [dontpoke.me](https://dontpoke.me) toolkit. Built by security researchers, for security researchers.
