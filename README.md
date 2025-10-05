# AI Voice Calendar - Base

## 🎯 Project Overview

AI Voice Calendar is an innovative calendar management application that combines natural language processing with blockchain-based accountability mechanisms. Built on Base (Ethereum L2), it allows users to manage their calendar through conversational AI while staking ETH on meetings to ensure attendance.

### Problem Statement

Traditional calendar management is tedious and meeting no-shows cost businesses billions annually. Current solutions lack:
- Intuitive natural language interfaces for calendar management
- Financial incentives for meeting attendance
- Automated scheduling with smart contact resolution
- Decentralized accountability mechanisms

### Our Solution

AI Voice Calendar solves these problems by:
- **Natural Language Calendar Management**: Talk to your calendar like a personal assistant
- **Smart Contact Resolution**: Automatically finds email addresses from contact names
- **ETH Staking for Accountability**: Stake ETH on meetings, get refunded for attendance
- **Base Blockchain Integration**: Low-cost, high-speed transactions on Base L2

## 🚀 Key Features

### 1. AI-Powered Calendar Assistant
- Natural language processing via OpenAI GPT-4
- Understands complex scheduling requests
- Automatic timezone handling
- Smart date/time parsing ("tomorrow at 3pm", "next Monday")

### 2. Google Calendar Integration
- OAuth 2.0 secure authentication
- Full CRUD operations on calendar events
- Real-time event synchronization
- Email invitations to attendees

### 3. Smart Contact Resolution
- Searches Google Contacts by name
- Confidence-based matching algorithm
- Mixed input support (names and emails)
- Automatic email resolution for meeting invites

### 4. Blockchain Staking Mechanism
- Create meetings with required ETH stakes
- Participants stake to confirm attendance
- Attendance verification via unique codes
- Automatic refunds for attendees
- Forfeited stakes go to meeting organizer

### 5. Base Blockchain Benefits
- Low transaction fees (~$0.01)
- Fast confirmation times (2 seconds)
- Ethereum security guarantees
- EVM compatibility

## 🏗️ Technical Architecture

### Tech Stack

**Frontend:**
- Next.js 15.5.3 with App Router
- React 19.1.0 with TypeScript
- TailwindCSS v4 for styling
- RainbowKit for wallet connection

**Blockchain:**
- Base (Ethereum L2) network
- Solidity smart contracts
- Ethers.js v6 for blockchain interaction
- Foundry for contract development

**Backend Services:**
- Google Calendar API
- Google People API (Contacts)
- OpenAI API (GPT-4o-mini)
- SQLite for local contact caching

**Infrastructure:**
- Vercel deployment
- JSON file-based encrypted storage
- JWT authentication

### Smart Contract Architecture

```solidity
MeetingStake.sol
├── createMeeting() - Initialize staked meeting
├── stake() - Participant stakes ETH
├── generateAttendanceCode() - Organizer creates verification code
├── submitAttendanceCode() - Attendee verifies presence
├── settleMeeting() - Distribute stakes based on attendance
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ and pnpm
- MetaMask or Coinbase Wallet
- Google Cloud Console account
- OpenAI API key
- Base Sepolia ETH (testnet)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-voice-calendar-base.git
cd ai-voice-calendar-base
```

2. Install dependencies:
```bash
cd ai-calendar
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

4. Deploy smart contracts (optional):
```bash
cd ../contracts
forge build
forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast
```

5. Run the development server:
```bash
cd ../ai-calendar
pnpm dev
```

6. Open http://localhost:3000

## 🔑 Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback

# OpenAI
OPENAI_API_KEY=your_openai_key

# Security
JWT_SECRET=your_jwt_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Base Blockchain
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
NEXT_PUBLIC_MEETING_STAKE_CONTRACT=0x... # After deployment

# Optional
BASESCAN_API_KEY=your_basescan_key
```

## 📱 Usage Guide

### 1. Connect Wallet
- Click "Connect Wallet" button
- Choose MetaMask or Coinbase Wallet
- Approve connection

### 2. Connect Google Calendar
- Click "Connect Google Calendar"
- Authorize calendar and contacts access
- Your calendar events will appear

### 3. Natural Language Commands

**Creating Events:**
- "Schedule a meeting with John tomorrow at 3pm"
- "Create a team standup every Monday at 9am"
- "Book a call with sarah@email.com next Friday"

**Managing Events:**
- "Show me my meetings this week"
- "Cancel my 2pm meeting today"
- "Move tomorrow's meeting to 4pm"

### 4. Staking on Meetings
- Create meeting with stake requirement
- Share meeting link with attendees
- Attendees stake ETH to confirm
- Generate attendance code during meeting
- Attendees submit code for refund

## 🏆 Hackathon Alignment

### Why Base?

1. **Low Fees**: ~$0.01 per transaction vs $5-50 on Ethereum mainnet
2. **Speed**: 2-second block times for instant confirmations
3. **Ecosystem**: Part of Coinbase's growing ecosystem
4. **Developer-Friendly**: EVM compatible with great tooling
5. **Security**: Inherits Ethereum's security model

### Innovation Highlights

- **First calendar app with native blockchain staking**
- **AI-powered scheduling with smart contact resolution**
- **Solves real business problem (meeting no-shows)**
- **Seamless Web2 + Web3 integration**
- **Production-ready with live demo**

## 📊 Smart Contract Addresses

### Base Sepolia Testnet
- MeetingStake: `0x...` (Deploy and update)

### Base Mainnet
- MeetingStake: `To be deployed`

## 🧪 Testing

### Smart Contracts
```bash
cd contracts
forge test
```

### Frontend
```bash
cd ai-calendar
pnpm test
```

## 🚢 Deployment

### Smart Contracts
```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url base --private-key $PRIVATE_KEY --broadcast --verify
```

### Frontend (Vercel)
```bash
vercel deploy --prod
```

## 📸 Screenshots

[Add screenshots here]

## 🎥 Demo Video

[Add demo video link]

## 🤝 Team

- **Your Name** - Full Stack Developer
- Built for Base Hackathon 2025

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Live Demo**: [https://your-app.vercel.app](https://your-app.vercel.app)
- **Smart Contracts**: [BaseScan](https://sepolia.basescan.org/address/0x...)
- **GitHub**: [https://github.com/yourusername/ai-voice-calendar-base](https://github.com/yourusername/ai-voice-calendar-base)

## 🙏 Acknowledgments

- Base team for the incredible L2 solution
- OpenAI for GPT-4 API
- Google for Calendar and Contacts APIs
- RainbowKit for wallet connection UI

---

Built with ❤️ for the Base Hackathon 2025