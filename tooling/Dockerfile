FROM node:26.8-bookworm-slim AS node
FROM golang:1.26.8-bookworm AS go
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git jq lz4 python3 python3-dev build-essential unzip zip file binutils && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
COPY --from=go /usr/local/go /usr/local/go
ENV PATH="/usr/local/go/bin:/root/vega/bin:${PATH}" GOTOOLCHAIN=local
COPY scripts/install-vega-sdk.sh /tmp/install-vega-sdk.sh
RUN bash /tmp/install-vega-sdk.sh
WORKDIR /work
CMD ["bash", "-c", "source /root/vega/env && npm ci --ignore-scripts && npm run verify && npm run build:release"]
