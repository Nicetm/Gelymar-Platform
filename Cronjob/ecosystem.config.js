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
        kill_timeout: 5000,
        max_memory_restart: '500M',
        restart_delay: 4000
      },
      {
        name: 'gelymar-order-reception',
        script: './cron/sendOrderReception.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        max_memory_restart: '300M',
        restart_delay: 4000
      },
      {
        name: 'gelymar-shipment-notice',
        script: './cron/sendShipmentNotice.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        max_memory_restart: '300M',
        restart_delay: 4000
      },
      {
        name: 'gelymar-order-delivery-notice',
        script: './cron/sendOrderDeliveryNotice.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        max_memory_restart: '300M',
        restart_delay: 4000
      },
      {
        name: 'gelymar-availability-notice',
        script: './cron/sendAvailableNotice.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        max_memory_restart: '300M',
        restart_delay: 4000
      },

      {
        name: 'gelymar-db-backup',
        script: './cron/sendDbBackup.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        max_memory_restart: '200M',
        restart_delay: 4000
      },
      {
        name: 'gelymar-admin-notifications',
        script: './cron/sendAdminNotifications.js',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        max_memory_restart: '200M',
        restart_delay: 4000
      }
    ]
  }; 
