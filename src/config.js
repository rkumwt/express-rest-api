'use strict';

const defaultConfig = {
  pagination: {
    defaultLimit: 10,
    maxLimit: 1000,
  },
  response: {
    envelope: true,
    timing: true,
  },
  messages: {
    created: 'Resource created successfully',
    updated: 'Resource updated successfully',
    deleted: 'Resource deleted successfully',
    notFound: 'Resource not found',
    validationFailed: 'Validation failed',
  },
  debug: false,
};

let config = JSON.parse(JSON.stringify(defaultConfig));

function configure(userConfig) {
  config = deepMerge(config, userConfig);
}

function getConfig() {
  return config;
}

function resetConfig() {
  config = JSON.parse(JSON.stringify(defaultConfig));
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

module.exports = { configure, getConfig, resetConfig, deepMerge };
