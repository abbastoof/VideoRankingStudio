/**
 * k6 load test for the VRS API.
 *
 * Run: k6 run -e BASE_URL=https://api.example.com infrastructure/loadtests/api.js
 *
 * The default scenario ramps up to 50 concurrent virtual users, sustains for
 * two minutes, then ramps back down. It targets endpoints that are safe to
 * poke without authentication (`/`, `/health`, `/v1/billing/plans`).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1600'],
    http_req_failed: ['rate<0.01'],
  },
};

const rootErrors = new Rate('root_errors');
const healthLatency = new Trend('health_latency_ms');

export default function main() {
  const root = http.get(`${BASE_URL}/`);
  rootErrors.add(root.status !== 200);
  check(root, { 'root ok': (r) => r.status === 200 });

  const health = http.get(`${BASE_URL}/health`);
  healthLatency.add(health.timings.duration);
  check(health, { 'health ok': (r) => r.status === 200 });

  const plans = http.get(`${BASE_URL}/v1/billing/plans`);
  check(plans, { 'plans ok': (r) => r.status === 200 });

  sleep(1);
}
