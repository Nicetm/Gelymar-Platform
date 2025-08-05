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
      },
      {
        name: 'gelymar-order-fetcher',
        script: './cron/checkOrders.js',
        watch: false,
        autorestart: true
      },
      {
        name: 'gelymar-item-fetcher',
        script: './cron/checkItems.js',
        watch: false,
        autorestart: true
      },
      {
        name: 'gelymar-orderline-fetcher',
        script: './cron/checkOrderLines.js',
        watch: false,
        autorestart: true
      },
      {
        name: 'gelymar-defaultfiles-generator',
        script: './cron/checkDefaultFiles.js',
        watch: true,
        autorestart: true
      }
    ]
  };
  