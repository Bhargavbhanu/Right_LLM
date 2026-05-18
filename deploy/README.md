# Deployment

Two paths are supplied:

## 1. Docker Compose (local / single VM)
```bash
cd /app/deploy
cp .env.example .env       # fill in EMERGENT_LLM_KEY
docker compose up -d
# Backend  → http://localhost:8001
# Frontend → http://localhost:3000
# Mongo    → mongodb://localhost:27017
```

## 2. Kubernetes Helm chart (production)
```bash
helm install right-llm /app/deploy/helm/right-llm \
  --namespace right-llm --create-namespace \
  --set secrets.emergentLlmKey=$EMERGENT_LLM_KEY \
  --set image.tag=v0.1.0 \
  --set ingress.host=rightllm.example.com
```

The chart provisions:
- backend Deployment + Service (`/api` traffic on port 8001, 3 replicas, HPA-ready)
- frontend Deployment + Service (port 3000, 2 replicas)
- ConfigMap with provider catalog overrides
- Optional Ingress (NGINX) with `/api` → backend, `/` → frontend
- MongoDB is BYO — set `mongo.url` in values.

Optional provider keys (set as Helm `--set secrets.*`):
- `GROQ_API_KEY`, `OLLAMA_BASE_URL`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`, `AZURE_OPENAI_API_KEY`/`AZURE_OPENAI_ENDPOINT`.

Models without configured keys still appear in the **TIPE Analyzer**, **Advisor** and **Routing** dashboards (based on published pricing); live calls return HTTP 501.
