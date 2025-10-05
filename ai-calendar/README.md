# AI Voice Calendar - Built on Flow Blockchain

## 🌊 Built on Flow

This project is **built on the Flow blockchain**, leveraging Flow's developer-friendly Cadence smart contracts for decentralized meeting staking and accountability mechanics.

## Project Overview

AI Voice Calendar is a Next.js 15 application that revolutionizes calendar management by combining:
- 🎯 **Natural language processing** via OpenAI for intuitive calendar interactions
- ⛓️ **Flow blockchain integration** for meeting staking and accountability
- 📅 **Google Calendar sync** with full CRUD operations
- 👥 **Smart contact resolution** via local contacts database
- 💰 **FLOW token staking** on meetings with reward distribution

Users authenticate via Flow wallet, connect their Google Calendar, interact through an AI-powered chat assistant, and can stake FLOW tokens on meetings to ensure accountability.

## Flow Blockchain Integration

### Deployed Contract Addresses

#### Flow Testnet
- **MeetingStaking Contract**: `0x2c3e84f9de31e3c7`
- **Network**: Flow Testnet
- **Access Node**: `https://access-testnet.onflow.org`

#### Flow Dependencies (Testnet)
- **FlowToken**: `0x7e60df042a9c0868`
- **FungibleToken**: `0x9a0766d93b6608b7`
- **MetadataViews**: `0x631e88ae7f1d7c20`
- **NonFungibleToken**: `0x631e88ae7f1d7c20`

### Smart Contract Features

The `MeetingStaking` contract deployed on Flow enables:
- **Meeting Creation**: Organizers create meetings with stake requirements
- **Participant Staking**: Attendees join by staking FLOW tokens
- **Attendance Tracking**: On-chain verification of meeting attendance
- **Reward Distribution**: Automatic redistribution of stakes based on attendance
- **Meeting Manager**: Per-user resource stored in Flow account storage

### Flow Integration Points

1. **Wallet Authentication**: Flow Client Library (FCL) for wallet connection
2. **Transaction Execution**: Cadence transactions for meeting operations
3. **State Queries**: Cadence scripts for reading meeting data
4. **Token Operations**: FLOW token transfers for staking mechanics

## Tech Stack

- **Frontend**: Next.js 15.5.3 with App Router, React 19.1.0, TypeScript
- **Blockchain**: Flow blockchain with Cadence smart contracts
- **Authentication**: Flow wallet via @onflow/fcl
- **Styling**: Tailwind CSS v4
- **Calendar**: Google Calendar API
- **Contacts**: Local SQLite database with Gmail sync
- **AI**: OpenAI GPT-4o-mini with function calling
- **Database**: Encrypted JSON storage

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Flow wallet (Blocto, Lilico, or Flow Wallet)
- Google Cloud Console project with Calendar API enabled
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-voice-calendar.git
cd ai-voice-calendar/ai-calendar

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Environment Variables

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback

# Security
JWT_SECRET=your_jwt_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Flow Blockchain Configuration
NEXT_PUBLIC_FLOW_NETWORK=testnet
NEXT_PUBLIC_ACCESS_NODE_API=https://access-testnet.onflow.org
NEXT_PUBLIC_WALLET_DISCOVERY=https://fcl-discovery.onflow.org/testnet/authn
NEXT_PUBLIC_APP_IDENTIFIER=ai-voice-calendar
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Flow Contract Addresses (Testnet)
NEXT_PUBLIC_MEETING_STAKING_ADDRESS=0x2c3e84f9de31e3c7
NEXT_PUBLIC_FLOW_TOKEN_ADDRESS=0x7e60df042a9c0868
```

### Development

```bash
# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Type checking
npx tsc --noEmit
```

## Features

### Natural Language Calendar Management
- Create events: "Schedule a meeting with Tom tomorrow at 3pm"
- Update events: "Move my 2pm meeting to 4pm"
- Delete events: "Cancel my Friday standup"
- Search events: "What meetings do I have next week?"

### Smart Contact Resolution
- Automatically resolves names to email addresses from Google Contacts
- Handles mixed input (names and emails)
- Creates calendar invitations with proper email notifications

### Flow Blockchain Staking
- Stake FLOW tokens when creating meetings
- Participants stake to confirm attendance
- Automatic reward distribution based on attendance
- On-chain meeting records for transparency

### AI-Powered Assistant
- ChatGPT-style interface for natural conversations
- Maintains context across interactions
- Executes calendar operations via function calling
- Timezone-aware datetime handling

## Project Structure

```
ai-calendar/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # API routes
│   │   │   ├── calendar/        # Calendar operations
│   │   │   └── assistant/       # AI assistant endpoint
│   │   └── page.tsx             # Main application page
│   ├── components/              # React components
│   ├── lib/                     # Core libraries
│   │   ├── services/            # Service layer
│   │   ├── flow/                # Flow blockchain utilities
│   │   └── db/                  # Database layer
│   └── types/                   # TypeScript definitions
├── cadence-contracts/           # Flow smart contracts
│   ├── cadence/
│   │   ├── contracts/           # Cadence contracts
│   │   ├── transactions/        # Cadence transactions
│   │   └── scripts/             # Cadence scripts
│   └── flow.json                # Flow configuration
└── README.md                    # This file
```

## Smart Contract Architecture

The Cadence contracts are located in `../cadence-contracts/`:

### MeetingStaking.cdc
Core contract managing meeting stakes and rewards:
- `MeetingManager`: User resource for managing meetings
- `MeetingInfo`: Struct containing meeting details
- `Participant`: Tracks individual stakes and attendance
- Public capabilities for querying meeting data
- Admin functions for attendance marking

### Key Transactions
- `setup_meeting_manager.cdc`: Initialize user's meeting capability
- `create_meeting.cdc`: Create meeting with stake requirement
- `join_meeting.cdc`: Join meeting with FLOW stake
- `mark_attendance.cdc`: Record attendance on-chain
- `finalize_meeting.cdc`: Complete meeting and distribute rewards
- `claim_reward.cdc`: Withdraw earned rewards

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

### Local Flow Emulator
```bash
cd ../cadence-contracts
flow emulator start
flow project deploy --network emulator
```

### Run Tests
```bash
# Frontend tests (when available)
pnpm test

# Cadence contract tests
flow test --cover cadence/tests/*.cdc
```

## Security Considerations

- OAuth tokens are encrypted using AES-256-CBC
- Wallet addresses serve as primary identifiers
- Automatic token refresh with 5-minute buffer
- Environment-based configuration for all secrets
- No sensitive data logged or exposed

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built on [Flow blockchain](https://flow.com)
- Powered by [OpenAI](https://openai.com) for natural language processing
- Integrated with [Google Calendar API](https://developers.google.com/calendar)
- UI components from [shadcn/ui](https://ui.shadcn.com)

## Support

For issues and feature requests, please open an issue on GitHub.

---

**This project is proudly built on Flow blockchain** - leveraging the power of Cadence smart contracts for decentralized meeting accountability.