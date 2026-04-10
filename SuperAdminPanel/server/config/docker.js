const Docker = require('dockerode');
const { getEnvConfig, getCurrentEnv } = require('./database');

function getDocker() {
  const envCfg = getEnvConfig(getCurrentEnv());
  if (!envCfg || !envCfg.docker) return new Docker();

  if (envCfg.docker.socketPath) {
    return new Docker({ socketPath: envCfg.docker.socketPath });
  }
  if (envCfg.docker.host) {
    const url = new URL(envCfg.docker.host);
    return new Docker({ host: url.hostname, port: url.port || 2375 });
  }
  return new Docker();
}

module.exports = { getDocker };
