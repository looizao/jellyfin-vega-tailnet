export default {
  start: jest.fn(),
  status: jest.fn(),
  stop: jest.fn(),
  checkServer: jest.fn(),
  engineVersion: jest.fn(() => 'Tailscale 1.102.4'),
};
