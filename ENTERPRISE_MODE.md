# Orca Dental AI - Enterprise Platform Documentation

## Overview

Enterprise-grade AI infrastructure platform with edge inference, per-tenant fine-tuning, and on-prem deployment support.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLOUD / HYBRID / ON-PREM                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│   │   Web App    │    │  AI Worker   │    │   Training   │         │
│   │   (Next.js)  │◄──►│   (Node.js)  │    │   Worker     │         │
│   └──────────────┘    └──────┬───────┘    └──────────────┘         │
│                              │                                       │
│          ┌───────────────────┼───────────────────┐                  │
│          │                   │                   │                  │
│          ▼                   ▼                   ▼                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│   │  Edge Node   │    │Local Model   │    │  External    │         │
│   │  (Regional)  │    │  (On-Prem)   │    │   Provider   │         │
│   └──────────────┘    └──────────────┘    └──────────────┘         │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │              Supabase (PostgreSQL + Auth)                 │     │
│   │  ┌─────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐│     │
│   │  │analysis │ │organization │ │   edge_     │ │training ││     │
│   │  │  jobs   │ │  models     │ │  nodes      │ │  jobs   ││     │
│   │  └─────────┘ └─────────────┘ └─────────────┘ └─────────┘│     │
│   └──────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Part 1: Edge Inference Layer

### Edge Nodes

Regional inference nodes that process AI jobs closer to users.

**Table:** `edge_nodes`
- `id` - UUID
- `name` - Node identifier
- `region` - Geographic region
- `status` - active/degraded/offline
- `public_url` - Endpoint URL
- `capacity_score` - Max concurrent jobs
- `current_load` - Active jobs
- `supports_local_models` - Can load custom models
- `hmac_secret` - Job signing secret
- `last_heartbeat` - Health timestamp

### Routing Strategies

| Strategy | Behavior |
|----------|----------|
| `edge_first` | Try edge first, fallback to central |
| `edge_only` | Edge only, fail if unavailable |
| `centralized_only` | Always use central providers |

Configure per organization:
```sql
UPDATE organizations 
SET edge_enabled = true,
    edge_routing_strategy = 'edge_first';
```

### Security

All edge jobs are signed with HMAC-SHA256:
```
signature = HMAC-SHA256(
  key: edge_node.hmac_secret,
  message: "{job_id}:{org_id}:{timestamp}"
)
```

Jobs expire after 60 seconds to prevent replay attacks.

### Deployment

```bash
# Deploy edge node in new region
docker run -d \
  --name edge-node-eu \
  -e NODE_ID=edge-eu-1 \
  -e REGION=eu-west-1 \
  -e HMAC_SECRET=secret-key \
  -e CENTRAL_API_URL=https://api.orca.ai \
  orca/edge-node:latest
```

## Part 2: Per-Tenant Fine-Tuning

### Organization Models

Each organization can have custom fine-tuned models.

**Table:** `organization_models`
- `id` - UUID
- `org_id` - Organization reference
- `base_model` - Starting model
- `fine_tuned_model_path` - Trained model location
- `version` - Model version
- `training_status` - draft/training/ready/failed/deprecated
- `metrics_json` - Training metrics
- `is_active` - Currently serving

### Training Pipeline

1. **Create Model Draft**
   ```typescript
   await createModel(orgId, "My Custom Model", "orca-ceph-v1");
   ```

2. **Start Training**
   ```typescript
   await startTraining(orgId, modelId, "s3://bucket/dataset", epochs);
   ```

3. **Training Worker Processes**
   - Loads dataset
   - Fine-tunes base model
   - Evaluates on validation set
   - Saves trained model
   - Updates metrics

4. **Activate Model**
   ```typescript
   await setActiveModel(orgId, modelId);
   ```

### Training Jobs Table

**Table:** `training_jobs`
- Tracks async training progress
- Progress percent updated during training
- Stores final metrics and actual cost

### Model Comparison

Compare models across metrics:
- Validation accuracy
- Training loss
- Inference time
- Model size

## Part 3: On-Prem Deployment

### Deployment Modes

| Mode | Description |
|------|-------------|
| `cloud` | Full SaaS, all providers available |
| `hybrid` | Cloud with edge/local options |
| `onprem` | Air-gapped, local-only |

Configure via environment:
```bash
DEPLOYMENT_MODE=onprem
```

### On-Prem Behavior

When `DEPLOYMENT_MODE=onprem`:
- External providers disabled
- Only local/edge inference
- Telemetry stored locally
- License validation enforced
- Single tenant (one org per deployment)

### License System

**Table:** `licenses`
- `license_key` - Unique license identifier
- `max_users` - User limit
- `max_monthly_jobs` - Monthly quota
- `expires_at` - Expiration date
- `is_revoked` - Active status

Worker validates license before processing:
```typescript
const license = await validateLicense(orgId);
if (!license.valid) {
  throw new Error("License expired or quota exceeded");
}
```

### Data Isolation

In on-prem mode:
- Multi-tenant access disabled
- Single organization per deployment
- Stronger RLS policies
- Optional air-gap (no outbound internet)

## Part 4: Enterprise Observability

### Audit Logs

**Table:** `audit_logs`
- Records all admin actions
- Immutable history
- Queryable by org/user/action

### Edge Node Metrics

**Table:** `edge_node_metrics`
- Time-series metrics (TimescaleDB)
- CPU, memory, request rate
- Response times, error rates

### Metrics Dashboard

Prometheus + Grafana pre-configured:
- Request rates by node
- Error rates by provider
- Training job duration
- License utilization

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

### Telemetry Events

| Event | Description |
|-------|-------------|
| `analysis_started` | Job queued |
| `analysis_done` | Job completed |
| `analysis_failed` | Job failed |
| `analysis_fallback_used` | Edge failed, used central |
| `model_trained` | Training completed |
| `license_expired` | License needs renewal |

## Deployment Guide

### Cloud Deployment

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your values

# 2. Run migration
psql $SUPABASE_URL -f infra/db/migrations/013_enterprise_edge_models.sql

# 3. Build and start
docker-compose up -d

# 4. Scale workers if needed
docker-compose up -d --scale ai-worker=3
```

### On-Prem Deployment

```bash
# 1. Set deployment mode
export DEPLOYMENT_MODE=onprem

# 2. Disable external providers in DB
UPDATE ai_providers SET is_active = false WHERE type = 'external';

# 3. Configure license
INSERT INTO licenses (org_id, license_key, max_users, max_monthly_jobs, expires_at)
VALUES ('your-org-id', 'license-key', 50, 10000, '2025-12-31');

# 4. Deploy
docker-compose up -d
```

### Edge Node Deployment

```bash
# Deploy to regional location
docker run -d \
  --name edge-ap-south \
  -p 8000:8000 \
  -e NODE_ID=edge-ap-south-1 \
  -e REGION=ap-south-1 \
  -e HMAC_SECRET=$(openssl rand -hex 32) \
  -e CENTRAL_API_URL=https://api.orca.ai \
  -e MODEL_PATH=/models \
  -v /mnt/models:/models \
  orca/edge-node:latest

# Register in central DB
INSERT INTO edge_nodes (name, region, public_url, hmac_secret, capacity_score)
VALUES ('edge-ap-south-1', 'ap-south-1', 'https://edge-ap.orca.ai', 'secret', 100);
```

## API Reference

### Edge Node Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/infer` | POST | Run inference (signed) |
| `/metrics` | GET | Node metrics |

### Worker RPC Functions

| Function | Purpose |
|----------|---------|
| `get_optimal_edge_node(org_id, region)` | Find best edge node |
| `verify_edge_job_signature(...)` | Validate job signature |
| `validate_license(org_id)` | Check license status |
| `claim_next_training_job()` | Get training work |
| `complete_training_job(...)` | Finish training |

## Scaling Considerations

### Horizontal Scaling

**AI Worker:**
```bash
docker-compose up -d --scale ai-worker=5
```
- Stateless design allows multiple workers
- Database handles job claiming with row locking

**Edge Nodes:**
- Deploy multiple nodes per region
- Load balancer distributes across nodes
- Each node reports capacity and load

**Training Worker:**
- Single instance (training is GPU-intensive)
- Queue handles concurrent requests

### Performance Tuning

| Setting | Default | Description |
|---------|---------|-------------|
| `POLL_INTERVAL` | 3000ms | Worker poll frequency |
| `EDGE_TIMEOUT` | 3000ms | Edge node timeout |
| `JOB_TIMEOUT` | 5min | Max job duration |
| `HEARTBEAT_INTERVAL` | 5s | Edge heartbeat frequency |

## Troubleshooting

### Edge Node Not Receiving Jobs

1. Check node status: `SELECT * FROM edge_nodes WHERE status = 'active'`
2. Verify HMAC secret matches
3. Check org has `edge_enabled = true`
4. Review routing strategy

### Training Job Stuck

1. Check training_jobs table status
2. Review training-worker logs
3. Verify GPU availability
4. Check dataset path accessibility

### License Validation Failed

1. Check licenses table for org
2. Verify not expired
3. Check monthly quota usage
4. Review `license_expired` telemetry events

### On-Prem External Calls

In on-prem mode, all external calls are blocked:
- External providers disabled
- Telemetry stored locally
- License validation local-only

## Backward Compatibility

All new features are opt-in:
- Organizations default to `cloud` mode
- Edge disabled by default
- Custom models disabled by default
- Existing jobs continue to work

Migration path:
1. Deploy new services
2. Run migration
3. Enable features per organization
4. Gradually migrate workloads

## Files Reference

### Database
- `infra/db/migrations/013_enterprise_edge_models.sql`

### Services
- `services/ai-worker/` - Enhanced worker with edge routing
- `services/edge-node/` - Regional inference server
- `services/training-worker/` - Fine-tuning pipeline
- `services/local-model/` - Central local inference

### Frontend
- `apps/web/src/app/[locale]/admin/models/` - Model management UI
- `apps/web/src/lib/db/models.ts` - Model management client
- `apps/web/src/lib/db/edge-nodes.ts` - Edge node client

### Deployment
- `docker-compose.yml` - Full stack orchestration
- `.env.example` - Configuration reference

## Support

For enterprise support:
- Documentation: https://docs.orca.ai
- Support Portal: https://support.orca.ai
- Email: enterprise@orca.ai
