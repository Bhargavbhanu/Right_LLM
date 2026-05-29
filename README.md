# Right LLM

AI Gateway & Cost Optimization Platform for Enterprise LLM Applications

## Overview

Right LLM is a production-grade AI gateway and optimization platform designed to help enterprises reduce Large Language Model (LLM) costs while maintaining response quality, latency, and governance.

The platform intelligently routes prompts between multiple AI providers such as OpenAI, Anthropic, Gemini, Groq, Azure, Ollama, and AWS Bedrock using a smart decision engine.

It acts as a middleware layer between enterprise applications and AI providers, automatically selecting the most cost-effective and best-performing model for each request.
https://app.cloudscore.ai/tokenmind
---

## Key Features

### Smart LLM Routing

* Automatically selects the best model based on:

  * Prompt complexity
  * Cost
  * Latency
  * Provider availability
  * Budget policies

### Semantic Cache

* L1 Exact Cache
* L2 Semantic Similarity Cache
* Reduces repeated token usage
* Improves response speed

### Cost Optimization Engine

* Prompt compression
* Token estimation
* Automatic model downgrading
* Budget-aware routing
* Usage forecasting

### Enterprise Dashboard

* Multi-page analytics dashboard
* Real-time provider monitoring
* Routing intelligence visualization
* Budget governance
* Forecasting & recommendations
* Autonomous optimization actions

### Multi-Provider Support

Supports:

* OpenAI
* Anthropic
* Gemini
* Groq
* Ollama
* Azure OpenAI
* AWS Bedrock

### Streaming Support

* SSE streaming endpoint
* Real-time token streaming
* OpenAI-compatible APIs

### Enterprise Ready

* Multi-tenant architecture
* Workspace switching
* Audit logs
* Optimization logs
* Provider health monitoring

---

# Architecture

```text
Enterprise Apps
        ↓
Right LLM Gateway
        ↓
Decision Engine
        ↓
┌──────────────────────────────┐
│ Semantic Cache               │
│ Routing Engine               │
│ Policy Engine                │
│ Optimization Engine          │
└──────────────────────────────┘
        ↓
Provider Layer
(OpenAI / Anthropic / Gemini / Groq / Ollama / Azure / Bedrock)
        ↓
Analytics + Observability
        ↓
Continuous Learning & Autonomous Actions
```

---

# Tech Stack

## Frontend

* React 19
* Tailwind CSS
* Shadcn UI
* Recharts
* React Router
* Axios
* Lucide React

## Backend

* FastAPI
* Motor (MongoDB)
* Pydantic
* Python
* JWT Authentication Utilities
* SSE Streaming

## Database

* MongoDB

## Infrastructure

* Docker
* Nginx
* Supervisor

---

# Project Structure

```bash
Right_LLM-main/
│
├── backend/               # FastAPI backend services
├── frontend/              # React frontend dashboard
├── deploy/                # Docker + deployment configs
├── tests/                 # Automated tests
├── test_reports/          # Test reports and iterations
├── memory/                # Product documentation & PRD
└── README.md
```

---

# Dashboard Modules

The platform currently includes:

* Overview Dashboard
* Routing Intelligence
* Semantic Cache Analytics
* Budget Governance
* Forecasting Engine
* AI Recommendations
* Provider Analytics
* Autonomous Actions
* Optimization Logs
* TIPE Analyzer
* Advisor Tools
* AI Playground
* User Guide

---

# API Endpoints

## Gateway

### Chat Completion

```http
POST /api/gateway/chat
```

### Streaming Chat

```http
POST /api/gateway/stream
```

---

## Routing & Optimization

```http
POST /api/routing/decision
POST /api/cache/search
POST /api/tipe/analyze
POST /api/advisor/migration
POST /api/advisor/best-model
```

---

## Analytics

```http
GET /api/analytics/usage
GET /api/forecast/predict
GET /api/advisor/recommend
GET /api/budgets/status
GET /api/actions/history
GET /api/providers/health
GET /api/routing/decisions
GET /api/cache/entries
GET /api/optimization/log
```

---

# Installation

## Prerequisites

Make sure you have installed:

* Node.js 18+
* Python 3.10+
* MongoDB
* Docker (optional)

---

# Backend Setup

```bash
cd backend

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file:

```env
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GEMINI_API_KEY=your_key
MONGO_URL=your_mongodb_url
DB_NAME=rightllm
```

Run backend:

```bash
uvicorn server:app --reload --port 8001
```

---

# Frontend Setup

```bash
cd frontend

npm install
npm start
```

Frontend runs on:

```text
http://localhost:3000
```

Backend runs on:

```text
http://localhost:8001
```

---

# Docker Deployment

```bash
cd deploy

docker-compose up --build
```

---

# Example Workflow

1. Enterprise application sends a request.
2. Right LLM analyzes the prompt.
3. Routing engine selects the optimal model.
4. Cache checks for previous semantic matches.
5. Request is optimized and forwarded.
6. Response metrics are tracked.
7. Analytics dashboard updates in real-time.

---

# Current Optimization Capabilities

* Prompt compression
* Token estimation
* Semantic similarity caching
* Budget-aware routing
* Provider failover
* Cost forecasting
* Autonomous downgrade actions
* Multi-provider orchestration

---

# Future Enhancements

* RBAC Authentication
* Kubernetes deployment
* Vector database integration
* Fine-tuned routing models
* AI governance policies
* Team-level quotas
* Reinforcement learning optimization
* Real-time anomaly detection

---

# Use Cases

## Enterprise AI Platforms

Reduce operational AI costs across multiple departments.

## Internal AI Assistants

Optimize routing for employee chatbots and copilots.

## SaaS Applications

Provide cost-efficient AI APIs to customers.

## AI Operations Teams

Track usage, governance, and provider performance.

---

# Screenshots

Add your dashboard screenshots here.

```md
![Dashboard](./screenshots/dashboard.png)
```

---

# Contributing

```bash
# Fork the repository
# Create your feature branch
git checkout -b feature/new-feature

# Commit changes
git commit -m "Added new feature"

# Push changes
git push origin feature/new-feature
```

---

# License

MIT License

---

# Author

Bhargav Naidu Maddipatla

LinkedIn:
[https://www.linkedin.com/in/bhargav1803/](https://www.linkedin.com/in/bhargav1803/)

---

# Why Right LLM?

Most companies are rapidly adopting AI but are struggling with:

* Rising API costs
* Poor model selection
* Lack of visibility
* Governance issues
* Vendor lock-in
* Inefficient prompt usage

Right LLM solves these problems by acting as an intelligent AI traffic controller that continuously optimizes requests across providers.

---

# Star the Repo

If you found this project useful, consider giving it a star on GitHub.
