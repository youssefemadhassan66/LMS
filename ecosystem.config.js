module.exports = {
  apps: [
    {
      name: "lms-backend",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      autorestart: true,
      max_memory_restart: "1G",
      restart_delay: 4000,
      listen_timeout: 8000,
      kill_timeout: 5000,
    },
  ],
};
