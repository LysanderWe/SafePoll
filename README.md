# SafePoll

A decentralized, privacy-preserving survey platform built on Ethereum using Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine) technology. SafePoll enables the creation and participation in surveys where votes remain encrypted throughout the entire process, ensuring complete privacy until results are intentionally decrypted.

## 🎯 Project Overview

SafePoll addresses the critical need for privacy in digital polling and survey systems. Traditional online surveys expose vote data to administrators and potential attackers. SafePoll eliminates these privacy concerns by leveraging fully homomorphic encryption (FHE), allowing mathematical operations on encrypted data without revealing the underlying information.

### Key Features

- **🔐 Complete Vote Privacy**: All votes are encrypted client-side and remain encrypted on-chain
- **📊 Multi-Question Surveys**: Support for complex surveys with multiple questions and options
- **🏗️ Decentralized Architecture**: No central authority can access individual votes
- **⚡ Real-time Survey Management**: Create, participate in, and manage surveys seamlessly
- **🔍 Transparent Results**: Survey creators can decrypt results while maintaining voter anonymity
- **🌐 Web3 Integration**: Full wallet connectivity with RainbowKit integration

## 🚀 Technology Stack

### Smart Contract Layer
- **Solidity ^0.8.24**: Smart contract development
- **Zama FHEVM**: Fully homomorphic encryption on Ethereum
- **@fhevm/solidity**: FHE operations library
- **Hardhat**: Development environment and testing framework
- **OpenZeppelin**: Security-audited contract libraries

### Frontend Application
- **React 19**: Modern UI library with concurrent features
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and development server
- **Wagmi v2**: Ethereum React hooks
- **RainbowKit**: Wallet connection interface
- **TanStack Query**: Efficient data fetching and caching
- **Ethers.js**: Ethereum library for blockchain interaction

### Development & Testing
- **Node.js >=20**: Runtime environment
- **ESLint**: Code linting and quality
- **Prettier**: Code formatting
- **Mocha & Chai**: Testing frameworks
- **TypeChain**: TypeScript bindings for smart contracts

### Cryptography & Privacy
- **Zama FHE**: Fully homomorphic encryption
- **Encrypted Types**: Type-safe encrypted data handling
- **Public/Private Key Cryptography**: Secure vote submission
- **Decryption Oracle**: Secure result revelation

## 🏗️ Architecture

### Smart Contract Architecture

The core `SafePoll.sol` contract implements a sophisticated privacy-preserving survey system:

```
SafePoll Contract
├── Survey Management
│   ├── createSurvey()     - Deploy new surveys
│   ├── endSurvey()        - Close survey to new votes
│   └── getSurveyInfo()    - Retrieve survey metadata
├── Voting System
│   ├── submitVotes()      - Submit encrypted votes
│   ├── hasUserVoted()     - Check voting status
│   └── getQuestion()      - Retrieve question data
├── Privacy & Decryption
│   ├── requestDecryption() - Initiate result decryption
│   ├── decryptionCallback() - Handle decryption results
│   └── getEncryptedOptionCount() - Access encrypted tallies
└── Data Structures
    ├── Survey struct       - Survey metadata
    ├── Question struct     - Question with encrypted counters
    └── DecryptedResults    - Final survey results
```

### Frontend Architecture

```
React Application
├── Components
│   ├── SurveyApp.tsx      - Main application component
│   ├── SurveyCreate.tsx   - Survey creation interface
│   ├── SurveyBrowse.tsx   - Survey participation & results
│   └── Header.tsx         - Navigation and wallet connection
├── Hooks
│   ├── useZamaInstance.tsx - FHE client integration
│   └── useEthersSigner.tsx - Ethereum transaction signing
├── Configuration
│   ├── wagmi.ts           - Web3 configuration
│   └── contracts.ts       - Contract ABI and addresses
└── Styles
    └── Global CSS         - Application styling
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v20 or higher)
- npm (v7 or higher)
- Git
- Ethereum wallet (MetaMask recommended)

### Clone and Install

```bash
git clone <repository-url>
cd SafePoll
npm install
cd home && npm install
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
# Ethereum Private Key for deployment
ETHEREUM_PRIVATE_KEY=your_private_key_here

# RPC Endpoints
SEPOLIA_RPC_URL=your_sepolia_rpc_url
MAINNET_RPC_URL=your_mainnet_rpc_url

# Optional: Etherscan API Key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Development Setup

1. **Compile Smart Contracts**:
   ```bash
   npm run compile
   ```

2. **Run Tests**:
   ```bash
   npm test
   ```

3. **Deploy to Sepolia Testnet**:
   ```bash
   npm run deploy:sepolia
   ```

4. **Start Frontend Development Server**:
   ```bash
   npm run frontend:dev
   ```

## 🎮 Usage Guide

### For Survey Creators

1. **Connect Wallet**: Use the "Connect Wallet" button to connect your Ethereum wallet
2. **Create Survey**:
   - Navigate to the "Create" tab
   - Enter survey title and description
   - Add questions with multiple choice options
   - Submit transaction to deploy survey on-chain
3. **Manage Survey**:
   - Monitor vote count in real-time
   - End survey when data collection is complete
   - Request result decryption to reveal final tallies

### For Survey Participants

1. **Browse Surveys**: View all available surveys on the main page
2. **Participate**:
   - Select an active survey
   - Answer all questions by selecting options
   - Submit encrypted votes with a single transaction
3. **View Results**: Check decrypted results after survey creator releases them

### Privacy Model

- **Vote Submission**: Individual votes are encrypted client-side using FHE
- **Vote Storage**: Encrypted votes are stored on-chain, inaccessible to anyone
- **Vote Counting**: FHE allows mathematical operations on encrypted votes
- **Result Revelation**: Only survey creators can decrypt final tallies
- **Anonymity**: Individual voting patterns remain completely private

## 🧪 Testing

The project includes comprehensive test suites:

```bash
# Run all tests
npm test

# Run tests on Sepolia testnet
npm run test:sepolia

# Run with coverage reporting
npm run coverage

# Lint code
npm run lint
```

### Test Coverage

- Smart contract functionality testing
- FHE encryption/decryption workflows
- Vote submission and tallying
- Access control and permissions
- Edge cases and error handling

## 🚀 Deployment

### Sepolia Testnet Deployment

```bash
# Deploy contracts
npm run deploy:sepolia

# Deploy and update frontend
npm run deploy:sepolia:full
```

### Production Deployment Checklist

- [ ] Security audit completed
- [ ] Gas optimization implemented
- [ ] Frontend performance optimized
- [ ] Error handling comprehensive
- [ ] Privacy model validated
- [ ] Multi-wallet testing completed

## 🔒 Security Considerations

### Smart Contract Security
- **Access Controls**: Only survey creators can end surveys and decrypt results
- **Input Validation**: All user inputs are validated on-chain
- **Reentrancy Protection**: State changes occur before external calls
- **Integer Overflow**: SafeMath patterns implemented

### Privacy Guarantees
- **Client-Side Encryption**: Votes encrypted before leaving user's browser
- **Zero-Knowledge**: Contract operations don't reveal vote content
- **Temporal Privacy**: Intermediate results remain encrypted
- **Cryptographic Integrity**: FHE prevents vote manipulation

### Known Limitations
- **Gas Costs**: FHE operations require higher gas consumption
- **Scalability**: Current implementation optimized for moderate survey sizes
- **Key Management**: Users must maintain wallet security for vote integrity

## 🛣️ Future Roadmap

### Phase 1: Core Enhancements (Q1 2024)
- [ ] **Gas Optimization**: Reduce transaction costs through batching and optimization
- [ ] **Mobile Support**: Responsive design and mobile wallet integration
- [ ] **Survey Templates**: Pre-built survey templates for common use cases
- [ ] **Advanced Question Types**: Support for ranking, rating scales, and text responses

### Phase 2: Advanced Features (Q2 2024)
- [ ] **Anonymous Authentication**: Zero-knowledge proof of eligibility without identity revelation
- [ ] **Time-based Surveys**: Automated survey lifecycle management
- [ ] **Result Analytics**: Statistical analysis tools for survey creators
- [ ] **Multi-chain Support**: Deploy on additional EVM-compatible chains

### Phase 3: Enterprise Features (Q3 2024)
- [ ] **Organization Accounts**: Multi-user survey management
- [ ] **API Integration**: RESTful API for external application integration
- [ ] **Governance Integration**: DAO voting and proposal systems
- [ ] **Advanced Cryptography**: Post-quantum cryptographic algorithms

### Phase 4: Ecosystem Expansion (Q4 2024)
- [ ] **Decentralized Identity**: Integration with DID systems
- [ ] **Incentive Mechanisms**: Token rewards for survey participation
- [ ] **Data Marketplace**: Encrypted data sharing and analytics
- [ ] **Cross-chain Interoperability**: Survey data portability across chains

## 🤝 Contributing

We welcome contributions from the community! Please see our contributing guidelines:

### Development Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- Follow TypeScript/Solidity best practices
- Maintain test coverage above 80%
- Use conventional commit messages
- Include comprehensive documentation

### Areas for Contribution
- Smart contract optimizations
- Frontend UX improvements
- Additional test coverage
- Documentation enhancements
- Translation and localization

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Zama**: Pioneering FHE technology and FHEVM development
- **Ethereum Foundation**: Providing the decentralized infrastructure
- **OpenZeppelin**: Security-audited smart contract libraries
- **RainbowKit Team**: Excellent wallet connectivity solutions
- **Hardhat Team**: Robust development environment

## 📞 Support & Community

- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Join community discussions in GitHub Discussions
- **Documentation**: Comprehensive docs available in `/docs` directory
- **Contact**: Reach out to the development team for enterprise inquiries

---

**SafePoll** - Empowering private, transparent, and decentralized decision-making through advanced cryptography and blockchain technology.