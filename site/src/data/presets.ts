export interface Preset {
  id: string
  name: string
  description: string
  data: () => unknown
}

export const PRESETS: Preset[] = [
  {
    id: 'people',
    name: '100 People',
    description: 'A dataset containing 100 uniform objects',
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
    id: 'weather',
    name: 'Weather API',
    description: 'Nested uniform weather objects for 30 days',
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
    name: 'E-commerce Products',
    description: 'Nested mixed product objects with ratings and specs',
    data: () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: `PROD-${String(i + 1).padStart(4, '0')}`,
        name: `Product ${i + 1}`,
        category: ['Electronics', 'Clothing', 'Books', 'Food', 'Sports'][i % 5],
        price: parseFloat((9.99 + i * 5.5).toFixed(2)),
        inStock: i % 4 !== 0,
        tags: [['new', 'featured'], ['sale'], ['popular', 'trending'], ['clearance'], ['new']].at(i % 5) as string[],
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
  {
    id: 'rag',
    name: 'RAG Chunks',
    description: 'Text-heavy non-uniform document chunks',
    data: () => [
      {
        id: 'chunk-001',
        source: 'docs/intro.md',
        content: 'XRON is a lossless serialization format designed to minimize token consumption when communicating with large language models.',
        metadata: { section: 'Introduction', page: 1, tokens: 28 },
      },
      {
        id: 'chunk-002',
        source: 'docs/format.md',
        content: 'Schema declarations use the @S prefix followed by the schema name and comma-separated field names.',
        metadata: { section: 'Format Spec', page: 2, tokens: 22 },
      },
      {
        id: 'chunk-003',
        source: 'docs/encoding.md',
        content: 'Level 2 encoding introduces dictionary compression where frequently repeated values are replaced with $index references.',
        metadata: { section: 'Encoding', page: 3, tokens: 25 },
      },
      {
        id: 'chunk-004',
        source: 'docs/delta.md',
        content: 'Delta compression in Level 3 replaces sequential numeric values with +N notation, where N is the difference from the previous value.',
        metadata: { section: 'Delta', page: 4, tokens: 30 },
      },
      {
        id: 'chunk-005',
        source: 'docs/api.md',
        content: 'The public API exposes XRON.stringify, XRON.parse, and XRON.analyze functions following standard serialization conventions.',
        metadata: { section: 'API', page: 5, tokens: 24 },
      },
    ],
  },
  {
    id: 'config',
    name: 'Config Object',
    description: 'Deeply nested non-uniform application configuration',
    data: () => ({
      app: { name: 'MyApplication', version: '2.1.0', environment: 'production' },
      database: { host: 'db.example.com', port: 5432, name: 'myapp_prod', ssl: true, poolSize: 20 },
      cache: { provider: 'redis', host: 'cache.example.com', port: 6379, ttl: 3600 },
      auth: {
        provider: 'oauth2',
        clientId: 'abc123',
        scopes: ['read', 'write', 'admin'],
        tokenExpiry: 86400,
      },
      features: {
        darkMode: true,
        betaFeatures: false,
        analyticsEnabled: true,
        maxUploadSize: 10485760,
      },
      logging: {
        level: 'info',
        format: 'json',
        destinations: ['stdout', 'file'],
        filePath: '/var/log/app.log',
      },
    }),
  },
]
