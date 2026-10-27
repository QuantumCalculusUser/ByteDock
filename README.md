# ByteDock

**A token-metered, AI-powered cloud coding workspace.**

ByteDock is a lightweight, browser-based development environment inspired by the simplicity of cloud IDEs and the flexibility of modern code editors. It combines a clean, dark coding interface with an AI coding agent powered by NVIDIA Nemotron through Nebius Token Factory.

The goal is simple: give developers a place to write, generate, run, debug, and test code without needing a complicated local development setup.

## Project Description

### What we are building

Traditional development environments can require significant local resources, configuration, and setup. AI coding assistants can help generate code, but developers still need an environment to execute it, inspect errors, and verify that it works.

ByteDock brings these workflows into one browser-based workspace.

Developers can edit project files, interact with an AI coding agent, execute code in an isolated environment, and review test results. A built-in resource management system tracks AI usage, CPU time, memory, storage, and workspace limits.

### Why we created it

We want to make cloud development more accessible, interactive, and resource-aware. Instead of requiring every developer to manage their own development infrastructure, ByteDock aims to provide a focused workspace where the available resources are transparent and usage is predictable.

The project explores how agentic engineering and resource-based access can work together in a practical developer tool.

### How it works

1. **Open a workspace:** Create or open a project in the browser.
2. **Write code:** Use the editor, file explorer, and integrated terminal.
3. **Ask the AI agent:** Describe a feature, request a fix, or ask for an explanation. NVIDIA Nemotron processes the request through Nebius Token Factory.
4. **Execute and test:** Run code in a restricted execution environment and inspect real output, errors, and test results.
5. **Track resource usage:** Monitor model tokens, compute usage, memory limits, storage, and remaining credits.
6. **Manage limits:** When a quota is exhausted, the relevant operation is paused and the user is shown their usage and available plan options.

## Features

- Browser-based coding workspace
- Monokai Pro-inspired dark theme
- Monospaced typography using Consolas and Courier New
- File explorer and code editor
- Integrated terminal and execution output
- AI-assisted code generation and modification
- Test execution and error analysis
- Token and resource usage dashboard
- Configurable workspace quotas
- Upgrade-flow prototype for higher resource limits

Feature availability depends on the current implementation. The initial prototype prioritizes the editor, AI coding workflow, code execution, and usage metering.

## Technology Stack

The proposed implementation uses:

- **Frontend:** React, TypeScript, and a modern CSS utility framework
- **Code editor:** Monaco Editor
- **Backend:** Python and FastAPI
- **AI inference:** NVIDIA Nemotron through Nebius Token Factory
- **Execution:** Isolated, resource-limited code runner
- **Usage tracking:** Backend-managed credit ledger and workspace quotas
- **Persistence:** Project files and usage records stored using a suitable database and storage layer

## Resource and Credit Model

ByteDock separates AI consumption from infrastructure resources.

- AI usage is measured using model token usage or an explicitly defined credit conversion.
- CPU usage is controlled through execution-time and compute limits.
- Memory usage is constrained by the execution environment.
- Storage is governed by a per-workspace quota.
- Workspace sessions are stopped or restricted when their applicable limits are reached.

A unified credit system can represent these resource costs, but it must not treat model tokens as a direct measurement of CPU, RAM, or disk usage.

Subscription plans and billing can be added after the core resource enforcement system is functional.

## Security

AI-generated code is untrusted code. Execution must take place in an isolated environment with enforced CPU, memory, time, and storage limits.

API credentials must remain on the backend and must never be exposed to the browser. The system should also enforce project access controls, usage limits, and restrictions on network and filesystem access.

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.11 or a compatible supported Python version
- A Nebius Token Factory account with API access
- Git

### Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/ByteDock.git
cd ByteDock
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Create and activate a Python virtual environment in the backend directory:

```bash
cd ../backend
python -m venv .venv
```

On Windows:

```powershell
.venv\Scripts\Activate.ps1
```

On Linux or macOS:

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file in the backend directory using the supplied `.env.example` file.

Configure the required Nebius credentials, API endpoint, and model identifier using the values provided by Nebius Token Factory. Never commit real API keys to the repository.

### Running the application

Start the backend:

```bash
cd backend
uvicorn main:app --reload
```

In a separate terminal, start the frontend:

```bash
cd frontend
npm run dev
```

Open the local development URL printed by the frontend development server.

These commands describe the intended development workflow. The repository must contain the corresponding application files and dependency manifests before the instructions can be considered verified.

## Hackathon Track

**Nebius × NVIDIA Global AI Hackathon**

**Track:** Coding and Agentic Engineering

ByteDock is designed to demonstrate how an AI coding agent can generate code, execute it, test it, and help developers diagnose failures within a resource-aware cloud workspace.

The AI inference integration uses NVIDIA Nemotron through Nebius Token Factory. The project will document the actual model identifier, inference workflow, and Nebius services used in the final implementation.

## Roadmap

- [ ] Build the coding workspace interface
- [ ] Add project creation and file editing
- [ ] Integrate NVIDIA Nemotron through Nebius Token Factory
- [ ] Implement code execution in an isolated environment
- [ ] Add test execution and failure analysis
- [ ] Implement resource quotas and credit accounting
- [ ] Add usage exhaustion and upgrade-flow handling
- [ ] Deploy a working demo
- [ ] Publish a demonstration video and setup instructions

## Contributing

Contributions, bug reports, and suggestions are welcome. Please open an issue before making major architectural changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
