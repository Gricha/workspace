# syntax=docker/dockerfile:1
# Perry Full Image
# Extends perry-base with additional language runtimes and tools.
# For a minimal image, use perry-base directly.

ARG BASE_IMAGE=perry-base:latest
FROM ${BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive

# Install additional system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    python3 \
    python3-pip \
    nano \
    vim \
    zsh \
    luarocks \
    imagemagick \
  && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2
RUN ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then AWS_ARCH="x86_64"; else AWS_ARCH="aarch64"; fi \
  && curl "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o "/tmp/awscliv2.zip" \
  && unzip /tmp/awscliv2.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/awscliv2.zip /tmp/aws \
  && aws --version

# Install Go
RUN ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then GO_ARCH="amd64"; elif [ "$ARCH" = "arm64" ]; then GO_ARCH="arm64"; else GO_ARCH="$ARCH"; fi \
  && curl -fsSL "https://go.dev/dl/go1.23.4.linux-${GO_ARCH}.tar.gz" -o /tmp/go.tar.gz \
  && tar -C /usr/local -xzf /tmp/go.tar.gz \
  && rm /tmp/go.tar.gz \
  && /usr/local/go/bin/go version

ENV PATH="/usr/local/go/bin:${PATH}"

# Install Tectonic (LaTeX)
RUN ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then TECTONIC_ARCH="x86_64-unknown-linux-musl"; elif [ "$ARCH" = "arm64" ]; then TECTONIC_ARCH="aarch64-unknown-linux-musl"; else TECTONIC_ARCH="$ARCH"; fi \
  && TECTONIC_VERSION=$(curl -s "https://api.github.com/repos/tectonic-typesetting/tectonic/releases/latest" | grep -Po '"tag_name": "tectonic@\K[^"]*') \
  && curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${TECTONIC_ARCH}.tar.gz" -o /tmp/tectonic.tar.gz \
  && tar -C /usr/local/bin -xzf /tmp/tectonic.tar.gz \
  && rm /tmp/tectonic.tar.gz \
  && tectonic --version

# Install yarn globally
USER workspace
RUN npm install -g yarn

# Install Playwright with Chromium
RUN bunx playwright install chromium --with-deps

USER root
WORKDIR /home/workspace

EXPOSE 22 2376

ENTRYPOINT ["/usr/local/bin/workspace-internal", "entrypoint"]
