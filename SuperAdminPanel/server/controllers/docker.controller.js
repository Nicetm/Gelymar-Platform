const { getDocker } = require('../config/docker');

exports.listContainers = async (req, res) => {
  try {
    const docker = getDocker();
    const containers = await docker.listContainers({ all: false });
    res.json(containers.map(c => ({
      id: c.Id,
      name: c.Names[0]?.replace('/', ''),
      image: c.Image,
      state: c.State,
      status: c.Status
    })));
  } catch (err) {
    res.status(500).json({ message: 'Error Docker: ' + err.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    const lines = parseInt(req.query.lines) || 200;
    const search = req.query.search || '';

    const logStream = await container.logs({ stdout: true, stderr: true, tail: lines, follow: false });
    let logs = logStream.toString('utf-8');

    // Strip Docker stream headers (8-byte prefix per line)
    logs = logs.replace(/[\x00-\x08]/g, '');

    let logLines = logs.split('\n');
    if (search) {
      logLines = logLines.filter(l => l.toLowerCase().includes(search.toLowerCase()));
    }

    res.json({ logs: logLines });
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo logs: ' + err.message });
  }
};
