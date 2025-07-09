// ecosystem.config.js
module.exports = {
    apps: [
      {
        name: 'gelymar-etd-checker',
        script: './cron/checkETD.js',
        watch: false,
        autorestart: true
      },
      {
        name: 'gelymar-client-fetcher',
        script: './cron/checkClients.js',
        watch: false,
        autorestart: true
      }
    ]
  };
  