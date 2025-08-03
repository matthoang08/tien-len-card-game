# Tien Len - Vietnamese Card Game

A modern implementation of **Tien Len** (also known as Thirteen or Vietnamese Poker) built with Next.js, React, and TypeScript. This retro-styled card game features pixel art aesthetics, WebSocket multiplayer support, and AI opponents.

![Game Screenshot](public/screenshot.png) <!-- TODO: Add actual screenshot -->

## 🎮 Game Features

- **Authentic Tien Len Rules**: Play the traditional Vietnamese card game with proper rule enforcement
- **Retro Pixel Art**: CRT scanlines, neon colors, and pixel-perfect card designs
- **Single Player Mode**: Play against 3 AI opponents with basic strategy
- **Multiplayer Support**: WebSocket-based multiplayer functionality (custom server included)
- **Responsive Design**: Works on desktop and mobile devices
- **Background Music**: Immersive audio experience with on/off toggle
- **Game Diagnostics**: Built-in tools for combo testing and validation

## 🃏 About Tien Len

Tien Len ( Tiến Lên ) is a popular Vietnamese card game for 2-4 players. The objective is to be the first player to get rid of all your cards by playing valid combinations that beat the previous play.

**Card Ranking**: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2 (2 is highest)
**Valid Combinations**:
- Single cards
- Pairs (two cards of same rank)
- Triples (three cards of same rank)
- Straights (3+ consecutive cards, cannot include 2)
- Bombs (four cards of same rank - beats everything)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm/yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd tien-len-game

# Install dependencies
pnpm install
```

### Development

```bash
# Run standard Next.js development server
pnpm dev

# Run custom WebSocket server (for multiplayer features)
pnpm dev:custom
```

Open [http://localhost:3000](http://localhost:3000) to play the game.

### Production Build

```bash
# Build for production
pnpm build

# Start production server (standard)
pnpm start

# Start production server with WebSocket support
pnpm start:custom
```

## 🏗️ Project Structure

```
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── test/           # Main game interface (page.tsx)
│   │   └── ...             # Other pages
│   ├── game/               # Core game logic and rules engine
│   └── ...                 # Other source files
├── public/                 # Static assets
├── server.ts              # Custom WebSocket server
└── ...
```

## 🎯 Key Components

### Game Engine (`src/game/tienlen.ts`)
- Complete Tien Len rules implementation
- Card combination detection and validation
- Game state management
- AI player logic

### Game Interface (`src/app/test/page.tsx`)
- Pixel-art retro styled UI
- 4-player game table visualization
- Interactive card selection
- Real-time game state display
- Music controls and diagnostics

### WebSocket Server (`server.ts`)
- Custom Next.js server with WebSocket support
- Multiplayer lobby system
- Basic chat functionality
- Room management

## 🎨 Styling

The game features a distinctive retro aesthetic:
- **Pixel Art Design**: Custom pixel-style cards, buttons, and panels
- **CRT Effects**: Scanlines and vignette overlays
- **Neon Color Scheme**: Purple/black background with green/pink accents
- **Press Start 2P Font**: Authentic retro gaming typography

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- WebSocket support with [ws](https://github.com/websockets/ws)
- Retro font from [Google Fonts](https://fonts.google.com/specimen/Press+Start+2P)

## 🚧 Future Improvements

- Enhanced AI strategy
- Tournament mode and scoring system
- Additional Tien Len variants
- Improved multiplayer features
- Mobile touch optimizations
- Customizable themes
