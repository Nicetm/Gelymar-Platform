// ecosystem.config.js
module.exports = {
    apps: [
      {
        name: 'gelymar-client-fetcher',
        script: './cron/checkClients.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000
      },
      {
        name: 'gelymar-item-fetcher',
        script: './cron/checkItems.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-client-fetcher']
      },
      {
        name: 'gelymar-order-fetcher',
        script: './cron/checkOrders.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-item-fetcher']
      },
      {
        name: 'gelymar-orderline-fetcher',
        script: './cron/checkOrderLines.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-order-fetcher']
      },
      {
        name: 'gelymar-defaultfiles-generator',
        script: './cron/checkDefaultFiles.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-orderline-fetcher']
      },
      {
        name: 'gelymar-etd-checker',
        script: './cron/checkETD.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-defaultfiles-generator']
      }
    ]
  };
  