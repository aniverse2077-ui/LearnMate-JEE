import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const PROFILE = __ENV.LOAD_PROFILE || '100vu';

const SCENARIOS = {
  '100vu': {
    executor: 'ramping-vus',
    startVUs: 10,
    stages: [
      { duration: '30s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 0 },
    ],
  },
  '1000vu': {
    executor: 'ramping-vus',
    startVUs: 50,
    stages: [
      { duration: '1m', target: 500 },
      { duration: '2m', target: 1000 },
      { duration: '1m', target: 0 },
    ],
  },
  '10000vu': {
    executor: 'ramping-vus',
    startVUs: 200,
    stages: [
      { duration: '2m', target: 5000 },
      { duration: '3m', target: 10000 },
      { duration: '2m', target: 0 },
    ],
  },
};

export const options = {
  scenarios: {
    study_workload: SCENARIOS[PROFILE] || SCENARIOS['100vu'],
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<600'],
  },
};

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  const plansRes = http.get(`${BASE_URL}/api/commercial/plans`);
  check(plansRes, {
    'plans catalog status is 200': (r) => r.status === 200,
  });

  const blueprintsRes = http.get(`${BASE_URL}/api/pyq/blueprints`);
  check(blueprintsRes, {
    'exam blueprints status is 200': (r) => r.status === 200,
  });

  const unauthAiRes = http.post(
    `${BASE_URL}/api/ai/tutor`,
    JSON.stringify({ prompt: 'Newton second law' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(unauthAiRes, {
    'unauth AI call fails closed with 401': (r) => r.status === 401,
  });

  sleep(1);
}
