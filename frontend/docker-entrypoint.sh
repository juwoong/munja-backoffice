#!/bin/sh

# Runtime environment variables injection for Vite apps

set -e

# Default values
VITE_API_URL=${VITE_API_URL:-"http://localhost:4000"}

echo "Injecting runtime environment variables..."
echo "VITE_API_URL: $VITE_API_URL"

# Create runtime config file
cat > /usr/share/nginx/html/config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  VITE_API_URL: "${VITE_API_URL}"
};
EOF

echo "Runtime configuration injected successfully"

# Execute the main command (nginx)
exec "$@"
