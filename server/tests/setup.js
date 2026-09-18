import { vi } from 'vitest';
vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() }, post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() }));
