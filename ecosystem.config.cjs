module.exports = {
  apps: [{
    name: 'slippage-monitor',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '512M',
    watch: false,
    autorestart: true,
  }],
};
