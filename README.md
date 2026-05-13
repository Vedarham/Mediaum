# Mediaum 🚀

> **Note**: This entire project was **AI-coded by Antigravity**, a coding assistant and I thought to make it available for everyone for free.

**Mediaum** is a premium, privacy-first web application for merging PDFs and converting images/PDFs. Built with a focus on local processing, your files never leave your computer.

![Mediaum Logo](public/logo.png)

## ✨ Features

- **Merge PDF**: Combine multiple PDF documents into a single, high-quality file.
- **Images to PDF**: Convert your photos and scans into professional PDF documents.
- **PDF to PPT**: Transform PDF pages into editable PowerPoint slides.
- **Collaborative Direct Share**: Real-time, peer-to-peer workspace for sharing files and text between devices (Mobile to Desktop and vice versa) without logins, email, or WhatsApp.
- **Local-First Processing**: All heavy lifting is done in your browser using `pdf-lib` and `pdf.js`. Data never leaves your device unless you choose to share it.
- **Premium UI**: Glassmorphism design system with smooth animations via `Framer Motion`.

## 🛠️ Technology Stack

- **Frontend**: React + Vite
- **Styling**: Vanilla CSS (Premium Glassmorphism System)
- **PDF Logic**: [pdf-lib](https://pdf-lib.js.org/)
- **PDF Rendering**: [pdf.js](https://mozilla.github.io/pdf.js/)
- **PPT Generation**: [PptxGenJS](https://gitbrent.github.io/PptxGenJS/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📡 Collaborative Direct Share
Mediaum features a unique, login-free way to sync your devices:
1. Open **Direct Share** on your desktop.
2. Scan the **QR Code** with your mobile or share the **Session Link**.
3. Instantly share files, links, and notes in a **Unified Feed**.
4. Data is transferred via **WebRTC (PeerJS)** directly between browsers, ensuring maximum privacy and speed.

## 🔒 Privacy & Security

Mediaum is designed with privacy as a core value. 
- **Zero Uploads**: Files are processed using the browser's File API and Web Workers.
- **No Analytics**: No tracking, no cookies, no data collection.
- **Open Source**: Verify the processing logic in `src/utils/`.

## 📄 License

MIT License - feel free to use and modify for your own projects!
