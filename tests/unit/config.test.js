'use strict';

const { configure, getConfig, resetConfig } = require('../../src/config');

describe('Config', () => {
  afterEach(() => {
    resetConfig();
  });

  it('should return default config', () => {
    const config = getConfig();
    expect(config.pagination.defaultLimit).toBe(10);
    expect(config.pagination.maxLimit).toBe(1000);
    expect(config.response.envelope).toBe(true);
    expect(config.response.timing).toBe(true);
    expect(config.debug).toBe(false);
    expect(config.messages.created).toBe('Resource created successfully');
  });

  it('should merge shallow scalar values', () => {
    configure({ debug: true });
    expect(getConfig().debug).toBe(true);
    // Other values unchanged
    expect(getConfig().pagination.defaultLimit).toBe(10);
  });

  it('should deep merge nested objects', () => {
    configure({ pagination: { defaultLimit: 25 } });
    const config = getConfig();
    expect(config.pagination.defaultLimit).toBe(25);
    expect(config.pagination.maxLimit).toBe(1000); // Unchanged
  });

  it('should override messages partially', () => {
    configure({ messages: { created: 'Created!' } });
    const config = getConfig();
    expect(config.messages.created).toBe('Created!');
    expect(config.messages.deleted).toBe('Resource deleted successfully'); // Unchanged
  });

  it('should reset to defaults', () => {
    configure({ debug: true, pagination: { defaultLimit: 50 } });
    expect(getConfig().debug).toBe(true);

    resetConfig();
    expect(getConfig().debug).toBe(false);
    expect(getConfig().pagination.defaultLimit).toBe(10);
  });

  it('should handle multiple configure calls', () => {
    configure({ pagination: { defaultLimit: 20 } });
    configure({ pagination: { maxLimit: 500 } });

    const config = getConfig();
    expect(config.pagination.defaultLimit).toBe(20);
    expect(config.pagination.maxLimit).toBe(500);
  });
});
