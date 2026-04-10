const { getDocker } = require('../config/docker');
const { getConfig } = require('../config/database');

async function execInContainer(containerName, cmd) {
  const docker = getDocker();
  const container = docker.getContainer(containerName);
  const exec = await container.exec({ Cmd: ['sh', '-c', cmd], AttachStdout: true, AttachStderr: true });
  const stream = await exec.start({ Detach: false });
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', chunk => { data += chunk.toString('utf-8'); });
    stream.on('end', () => resolve(data.replace(/[\x00-\x08]/g, '')));
    stream.on('error', reject);
  });
}

exports.listProcesses = async (req, res) => {
  try {
    const config = getConfig();
    const containerName = config.pm2ContainerName || 'gelymar-cron';
    const output = await execInContainer(containerName, 'pm2 jlist');
    const processes = JSON.parse(output);
    res.json(processes.map(p => ({
      name: p.name,
      pm_id: p.pm_id,
      status: p.pm2_env?.status,
      cpu: p.monit?.cpu,
      memory: p.monit?.memory,
      restarts: p.pm2_env?.restart_time
    })));
  } catch (err) {
    res.status(500).json({ message: 'Error PM2: ' + err.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const config = getConfig();
    const containerName = config.pm2ContainerName || 'gelymar-cron';
    const lines = parseInt(req.query.lines) || 200;
    const output = await execInContainer(containerName, `pm2 logs ${req.params.name} --nostream --lines ${lines}`);
    res.json({ logs: output.split('\n') });
  } catch (err) {
    res.status(500).json({ message: 'Error PM2 logs: ' + err.message });
  }
};
