// ecosystem.config.js
module.exports = {
    apps: [
      {
        name: 'gelymar-cron-sequence',
        script: './cron/cronMaster.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000
      },
      {
        name: 'gelymar-etd-checker',
        script: './cron/checkETD.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000
      }
    ]
  }; 