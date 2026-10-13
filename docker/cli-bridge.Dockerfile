FROM node:22-bookworm-slim AS cli-base
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl libsecret-1-0 \
    && rm -rf /var/lib/apt/lists/*
FROM cli-base AS codex-binary
RUN --mount=type=cache,target=/root/.npm npm install -g @openai/codex@0.162.1 && codex --version

FROM cli-base AS agy-binary
ARG TARGETARCH
COPY docker/cli-bridge/install-agy.sh /tmp/install-agy.sh
RUN sh /tmp/install-agy.sh "$TARGETARCH" && rm /tmp/install-agy.sh

FROM cli-base AS runtime
WORKDIR /app
COPY docker/cli-bridge/package.json docker/cli-bridge/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
COPY scripts/cli-gateway.ts ./scripts/cli-gateway.ts
COPY src/lib/output-redaction.ts src/lib/cli-bridge-token.ts ./src/lib/
COPY docker/cli-bridge/entrypoint.sh docker/cli-bridge/init.mjs docker/cli-bridge/healthcheck.mjs ./docker/cli-bridge/
RUN chmod 755 docker/cli-bridge/entrypoint.sh
ENV PATH="/app/node_modules/.bin:${PATH}" \
    HOME=/home/node CLI_BRIDGE_HOST=0.0.0.0 \
    CLI_BRIDGE_TOKEN_FILE=/run/secrets/bridge_token
ENTRYPOINT ["/app/docker/cli-bridge/entrypoint.sh"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["node", "/app/docker/cli-bridge/healthcheck.mjs"]

FROM runtime AS codex
COPY --from=codex-binary /usr/local/lib/node_modules/@openai /usr/local/lib/node_modules/@openai
RUN ln -s /usr/local/lib/node_modules/@openai/codex/bin/codex.js /usr/local/bin/codex
ENV CLI_BRIDGE_PROVIDER=codex CODEX_BIN=/usr/local/bin/codex CODEX_HOME=/home/node/.codex
USER node
EXPOSE 3006
CMD ["tsx", "scripts/cli-gateway.ts"]

FROM runtime AS agy
COPY --from=agy-binary /usr/local/bin/agy /usr/local/bin/agy
ENV CLI_BRIDGE_PROVIDER=agy AGY_BIN=/usr/local/bin/agy
USER node
EXPOSE 3005
CMD ["tsx", "scripts/cli-gateway.ts", "--agy"]
