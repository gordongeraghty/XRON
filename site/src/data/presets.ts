export interface Preset {
  id: string
  name: string
  description: string
  /** Short tag shown in the selector to explain what this preset demonstrates */
  tag?: string
  data: () => unknown
}

export const PRESETS: Preset[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // HIGH COMPRESSION — these demonstrate 65-80%+ reduction
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'employees-500',
    name: '500 Employees (High Compression)',
    description: '500 uniform rows with sequential IDs, repeated departments, booleans, and dates. Exercises every compression layer — schema, dictionary, delta, type compaction.',
    tag: '~75-80% reduction',
    data: () =>
      Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        name: ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'Dave Brown', 'Eve Davis',
               'Frank Miller', 'Grace Lee', 'Hank Wilson', 'Ivy Taylor', 'Jack Moore'][i % 10],
        email: `user${i + 1}@example.com`,
        department: ['Sales', 'Engineering', 'Marketing', 'HR', 'Finance'][i % 5],
        active: i % 3 !== 0,
        salary: 50000 + i * 500,
        joinDate: `2020-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
      })),
  },
  {
    id: 'people-100',
    name: '100 People',
    description: '100 uniform objects with 7 fields. Good schema + dictionary + delta compression.',
    tag: '~65-70% reduction',
    data: () =>
      Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'Dave Brown', 'Eve Davis'][i % 5],
        email: `user${i + 1}@example.com`,
        department: ['Sales', 'Engineering', 'Marketing', 'HR', 'Finance'][i % 5],
        active: i % 3 !== 0,
        salary: 50000 + i * 1000,
        joinDate: `2020-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
      })),
  },
  {
    id: 'iot-sensors',
    name: '200 IoT Sensor Readings (High Compression)',
    description: '200 time-series readings with constant-delta timestamps, repeating sensor IDs, and boolean alerts. Ideal for delta + dictionary encoding.',
    tag: '~70-75% reduction',
    data: () =>
      Array.from({ length: 200 }, (_, i) => ({
        timestamp: `2026-04-01T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
        sensorId: ['sensor-A1', 'sensor-A2', 'sensor-B1', 'sensor-B2'][i % 4],
        temperature: parseFloat((20 + Math.sin(i * 0.1) * 5).toFixed(1)),
        humidity: parseFloat((60 + Math.cos(i * 0.1) * 10).toFixed(1)),
        status: ['normal', 'normal', 'normal', 'warning', 'normal'][i % 5],
        alert: i % 20 === 0,
      })),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // MEDIUM COMPRESSION — 40-60% range
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'weather',
    name: '30 Weather Records (Medium)',
    description: '30 nested weather objects. Schema extraction helps, but nested objects and unique values limit dictionary encoding.',
    tag: '~45-55% reduction',
    data: () =>
      Array.from({ length: 30 }, (_, i) => ({
        date: `2026-0${Math.floor(i / 10) + 1}-${String((i % 10) + 1).padStart(2, '0')}`,
        location: {
          city: ['New York', 'London', 'Tokyo'][i % 3],
          country: ['US', 'UK', 'JP'][i % 3],
          lat: [40.71, -51.51, 35.68][i % 3],
          lon: [-74.0, -0.12, 139.69][i % 3],
        },
        temperature: {
          min: 10 + (i % 15),
          max: 20 + (i % 15),
          avg: 15 + (i % 15),
          unit: 'celsius',
        },
        humidity: 50 + (i % 30),
        windSpeed: 10 + (i % 20),
        conditions: ['sunny', 'cloudy', 'rainy', 'windy', 'partly cloudy'][i % 5],
      })),
  },
  {
    id: 'products',
    name: '25 E-commerce Products (Medium)',
    description: '25 product objects with nested specs and ratings. Mixed benefit: schema helps, but many unique values.',
    tag: '~40-50% reduction',
    data: () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: `PROD-${String(i + 1).padStart(4, '0')}`,
        name: `Product ${i + 1}`,
        category: ['Electronics', 'Clothing', 'Books', 'Food', 'Sports'][i % 5],
        price: parseFloat((9.99 + i * 5.5).toFixed(2)),
        inStock: i % 4 !== 0,
        tags: [['new', 'featured'], ['sale'], ['popular', 'trending'], ['clearance'], ['new']][i % 5] as string[],
        specs: {
          weight: `${(0.5 + i * 0.1).toFixed(1)}kg`,
          dimensions: `${10 + i}x${5 + i}x${3 + i}cm`,
        },
        rating: {
          average: parseFloat((3.5 + (i % 15) * 0.1).toFixed(1)),
          count: 10 + i * 7,
        },
      })),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // LOW / NO COMPRESSION — auto mode returns JSON or uses L1
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'tiny-object',
    name: 'Tiny Object (Auto → JSON)',
    description: 'A single small object. Auto mode detects this is too small for XRON headers and returns raw JSON instead — no wasted overhead.',
    tag: '0% — auto skips compression',
    data: () => ({ id: 1, name: 'Alice', role: 'admin' }),
  },
  {
    id: 'config',
    name: 'Config Object (Auto → L1)',
    description: 'A deeply nested config with no repeating schemas. Auto selects Level 1 — higher levels add overhead with no benefit.',
    tag: '~10-20% reduction',
    data: () => ({
      app: { name: 'MyApplication', version: '2.1.0', environment: 'production' },
      database: { host: 'db.example.com', port: 5432, name: 'myapp_prod', ssl: true, poolSize: 20 },
      cache: { provider: 'redis', host: 'cache.example.com', port: 6379, ttl: 3600 },
      auth: { provider: 'oauth2', clientId: 'abc123', scopes: ['read', 'write', 'admin'], tokenExpiry: 86400 },
      features: { darkMode: true, betaFeatures: false, analyticsEnabled: true, maxUploadSize: 10485760 },
      logging: { level: 'info', format: 'json', destinations: ['stdout', 'file'], filePath: '/var/log/app.log' },
    }),
  },
  {
    id: 'rag',
    name: 'RAG Chunks (Low Compression)',
    description: 'Text-heavy document chunks. Content is unique per chunk so dictionary encoding barely helps. Schema extraction saves some key overhead.',
    tag: '~20-30% reduction',
    data: () => [
      { id: 'chunk-001', source: 'docs/intro.md', content: 'XRON is a lossless serialization format designed to minimize token consumption when communicating with large language models.', metadata: { section: 'Introduction', page: 1, tokens: 28 } },
      { id: 'chunk-002', source: 'docs/format.md', content: 'Schema declarations use the @S prefix followed by the schema name and comma-separated field names.', metadata: { section: 'Format Spec', page: 2, tokens: 22 } },
      { id: 'chunk-003', source: 'docs/encoding.md', content: 'Level 2 encoding introduces dictionary compression where frequently repeated values are replaced with $index references.', metadata: { section: 'Encoding', page: 3, tokens: 25 } },
      { id: 'chunk-004', source: 'docs/delta.md', content: 'Delta compression in Level 3 replaces sequential numeric values with +N notation, where N is the difference from the previous value.', metadata: { section: 'Delta', page: 4, tokens: 30 } },
      { id: 'chunk-005', source: 'docs/api.md', content: 'The public API exposes XRON.stringify, XRON.parse, and XRON.analyze functions following standard serialization conventions.', metadata: { section: 'API', page: 5, tokens: 24 } },
    ],
  },
  {
    id: 'mixed-array',
    name: 'Mixed Non-Uniform Array (Low Compression)',
    description: 'An array of objects with different shapes — no shared schema. XRON falls back to inline encoding, providing minimal savings.',
    tag: '~5-15% reduction',
    data: () => [
      { type: 'user', name: 'Alice', email: 'alice@example.com' },
      { type: 'order', orderId: 1234, total: 59.99, items: 3 },
      { type: 'event', name: 'PageView', url: '/dashboard', timestamp: '2026-04-01T10:30:00Z' },
      { type: 'error', code: 500, message: 'Internal server error', stack: 'at handler (/app/api.js:42:5)' },
      { type: 'metric', name: 'response_time', value: 142, unit: 'ms' },
    ],
  },
]
