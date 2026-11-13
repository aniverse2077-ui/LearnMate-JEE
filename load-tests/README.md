# LearnMate JEE Load Testing Profiles

Representative `k6` load-test profiles for evaluating non-AI HTTP control plane throughput, rate-limiter saturation, and fail-closed auth overhead before staging deployment.

## Prerequisites
- Install [k6](https://k6.io/docs/get-started/installation/)
- Start the LearnMate server (`npm start` or Cloud Run staging target)

## Profiles

1. **100 Virtual Users (Single-Instance Baseline)**
   ```bash
   LOAD_PROFILE=100vu BASE_URL=http://127.0.0.1:3000 k6 run load-tests/k6-study-api.js
   ```

2. **1,000 Virtual Users (Regional Burst Simulation)**
   ```bash
   LOAD_PROFILE=1000vu BASE_URL=https://staging.example.com k6 run load-tests/k6-study-api.js
   ```

3. **10,000 Virtual Users (Horizontal Auto-Scale Target)**
   Requires horizontal Cloud Run / managed Redis backing for shared quota counters (`rateLimiterAndQuotas.ts` uses per-instance bounded memory unless upgraded to Redis).
   ```bash
   LOAD_PROFILE=10000vu BASE_URL=https://staging.example.com k6 run load-tests/k6-study-api.js
   ```
