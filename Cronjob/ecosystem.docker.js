// ecosystem.config.js para Docker
module.exports = {
    apps: [
      {
        name: 'gelymar-client-fetcher',
        script: './modules/checkClients.js',
        args: 'execute-now',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        env: {
          BACKEND_API_URL: 'http://backend:3000'
        }
      },
      {
        name: 'gelymar-client-access-checker',
        script: './modules/checkClientAccess.js',
        args: 'execute-now',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-client-fetcher'],
        env: {
          BACKEND_API_URL: 'http://backend:3000'
        }
      },
      {
        name: 'gelymar-item-fetcher',
        script: './modules/checkItems.js',
        args: 'execute-now',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-client-access-checker'],
        env: {
          BACKEND_API_URL: 'http://backend:3000'
        }
      },
      {
        name: 'gelymar-order-fetcher',
        script: './modules/checkOrders.js',
        args: 'execute-now',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-item-fetcher'],
        env: {
          BACKEND_API_URL: 'http://backend:3000'
        }
      },
      {
        name: 'gelymar-orderline-fetcher',
        script: './modules/checkOrderLines.js',
        args: 'execute-now',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-order-fetcher'],
        env: {
          BACKEND_API_URL: 'http://backend:3000'
        }
      },
      {
        name: 'gelymar-defaultfiles-generator',
        script: './modules/checkDefaultFiles.js',
        args: 'execute-now',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-orderline-fetcher'],
        env: {
          BACKEND_API_URL: 'http://backend:3000'
        }
      },
      {
        name: 'gelymar-etd-checker',
        script: './modules/checkETD.js',
        args: 'execute-now',
        watch: false,
        autorestart: true,
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,
        dependencies: ['gelymar-defaultfiles-generator'],
        env: {
          BACKEND_API_URL: 'http://backend:3000'
        }
      }
    ]
  }; 