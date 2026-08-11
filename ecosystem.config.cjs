// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.cjs
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: 'slippage-monitor',
      script: '.next/standalone/server.js',
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_FORMAT: 'json',
      },
      // Log configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      // Memory limit — restart if exceeds
      max_memory_restart: '512M',
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Watch disabled in production
      watch: false,
    },
  ],
};
