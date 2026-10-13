#!/bin/sh
set -eu
umask 077
node /app/docker/cli-bridge/init.mjs
exec "$@"
