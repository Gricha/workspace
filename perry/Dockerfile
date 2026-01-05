# syntax=docker/dockerfile:1
# Workspace Ubuntu Noble Dockerfile
# Provides a reusable Docker-in-Docker environment with SSH access.
# Migrated from Alpine to Ubuntu Noble (24.04 LTS)

FROM ubuntu:noble

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install prerequisites for adding Docker repository
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key and repository
RUN install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine, CLI, and development tools
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    bash \
    sudo \
    openssh-server \
    git \
    curl \
    wget \
    tzdata \
    python3 \
    python3-pip \
    jq \
    rsync \
    unzip \
    zip \
    nano \
    vim \
    iproute2 \
    iptables \
    kmod \
    openssl \
    procps \
    ripgrep \
    fd-find \
    fzf \
    zsh \
    luarocks \
    imagemagick \
    ninja-build \
    gettext \
    cmake \
    build-essential

# Build Neovim v0.11.4 from source
RUN git clone --depth 1 --branch v0.11.4 https://github.com/neovim/neovim.git /tmp/neovim \
  && cd /tmp/neovim \
  && make CMAKE_BUILD_TYPE=RelWithDebInfo \
  && make install \
  && cd / \
  && rm -rf /tmp/neovim \
  && nvim --version

RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update \
  && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/* \
  && gh --version

# Install AWS CLI v2 for the correct architecture
RUN ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then AWS_ARCH="x86_64"; else AWS_ARCH="aarch64"; fi \
  && curl "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o "/tmp/awscliv2.zip" \
  && unzip /tmp/awscliv2.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/awscliv2.zip /tmp/aws \
  && aws --version

# Install docker-init (tini) for proper process management
RUN curl -fsSL https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-$(dpkg --print-architecture) -o /usr/local/bin/docker-init \
  && chmod +x /usr/local/bin/docker-init

# Set up iptables-legacy for compatibility (many DinD setups work better with legacy)
RUN update-alternatives --set iptables /usr/sbin/iptables-legacy || true \
  && update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy || true

# Create legacy iptables directory structure for dockerd-entrypoint.sh compatibility
RUN mkdir -p /usr/local/sbin/.iptables-legacy \
  && ln -s /usr/sbin/iptables-legacy /usr/local/sbin/.iptables-legacy/iptables \
  && ln -s /usr/sbin/ip6tables-legacy /usr/local/sbin/.iptables-legacy/ip6tables

RUN ln -sf /usr/share/zoneinfo/UTC /etc/localtime \
  && echo "UTC" > /etc/timezone

RUN mkdir -p /run/sshd \
  && ssh-keygen -A \
  && sed -i 's/#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config \
  && sed -i 's/#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config \
  && sed -i 's/#\?AllowTcpForwarding.*/AllowTcpForwarding yes/' /etc/ssh/sshd_config \
  && sed -i 's/#\?AllowAgentForwarding.*/AllowAgentForwarding yes/' /etc/ssh/sshd_config \
  && sed -i 's/#\?GatewayPorts.*/GatewayPorts clientspecified/' /etc/ssh/sshd_config \
  && echo 'SetEnv PATH=/home/workspace/.npm-global/bin:/home/workspace/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' >> /etc/ssh/sshd_config

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y nodejs \
  && node --version \
  && npm --version

ENV BUN_INSTALL=/usr/local
RUN bash -lc "curl -fsSL https://bun.sh/install | bash" \
  && bun --version

RUN curl -fsSL https://deno.land/install.sh | sh \
  && mv /root/.deno/bin/deno /usr/local/bin/deno \
  && deno --version

RUN ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then GO_ARCH="amd64"; elif [ "$ARCH" = "arm64" ]; then GO_ARCH="arm64"; else GO_ARCH="$ARCH"; fi \
  && curl -fsSL "https://go.dev/dl/go1.23.4.linux-${GO_ARCH}.tar.gz" -o /tmp/go.tar.gz \
  && tar -C /usr/local -xzf /tmp/go.tar.gz \
  && rm /tmp/go.tar.gz \
  && /usr/local/go/bin/go version

ENV PATH="/usr/local/go/bin:${PATH}"

RUN ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then LAZYGIT_ARCH="x86_64"; elif [ "$ARCH" = "arm64" ]; then LAZYGIT_ARCH="arm64"; else LAZYGIT_ARCH="$ARCH"; fi \
  && LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\K[^"]*') \
  && curl -fsSL "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${LAZYGIT_VERSION}_Linux_${LAZYGIT_ARCH}.tar.gz" -o /tmp/lazygit.tar.gz \
  && tar -C /usr/local/bin -xzf /tmp/lazygit.tar.gz lazygit \
  && rm /tmp/lazygit.tar.gz \
  && lazygit --version

RUN ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then TECTONIC_ARCH="x86_64-unknown-linux-gnu"; elif [ "$ARCH" = "arm64" ]; then TECTONIC_ARCH="aarch64-unknown-linux-musl"; else TECTONIC_ARCH="$ARCH"; fi \
  && TECTONIC_VERSION=$(curl -s "https://api.github.com/repos/tectonic-typesetting/tectonic/releases/latest" | grep -Po '"tag_name": "tectonic@\K[^"]*') \
  && curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${TECTONIC_ARCH}.tar.gz" -o /tmp/tectonic.tar.gz \
  && tar -C /usr/local/bin -xzf /tmp/tectonic.tar.gz \
  && rm /tmp/tectonic.tar.gz \
  && tectonic --version

# Create workspace user with passwordless sudo
RUN useradd -m -s /bin/bash workspace \
  && echo "workspace:workspace" | chpasswd \
  && usermod -aG sudo workspace \
  && usermod -aG docker workspace \
  && echo "%sudo ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Configure npm to use user-writable global directory
USER workspace
RUN mkdir -p /home/workspace/.npm-global \
  && npm config set prefix '/home/workspace/.npm-global' \
  && npm install -g yarn \
  && npm install -g @mermaid-js/mermaid-cli

USER root
ENV PATH="/home/workspace/.npm-global/bin:/root/.local/bin:/home/workspace/.local/bin:${PATH}"

# Enable BuildKit for docker build and docker compose
ENV DOCKER_BUILDKIT=1
ENV COMPOSE_DOCKER_CLI_BUILD=1

USER workspace

RUN curl -fsSL https://claude.ai/install.sh | bash

RUN curl -fsSL https://opencode.ai/install | bash

USER root

ENV PATH="/home/workspace/.opencode/bin:${PATH}"

RUN mkdir -p /home/workspace /workspace/config /workspace/template /workspace/source \
  && chown -R workspace:workspace /home/workspace /workspace

COPY scripts /opt/workspace/scripts
COPY internal/package.json /opt/workspace/internal/package.json
RUN cd /opt/workspace/internal && bun install --production
COPY internal /opt/workspace/internal
RUN chmod +x /opt/workspace/scripts/dockerd-entrypoint.sh \
  && install -m 0755 /opt/workspace/scripts/dockerd-entrypoint.sh /usr/local/bin/dockerd-entrypoint.sh \
  && chmod +x /opt/workspace/internal/src/index.ts \
  && printf '#!/bin/sh\nexec bun /opt/workspace/internal/src/index.ts "$@"\n' > /usr/local/bin/workspace-internal \
  && chmod +x /usr/local/bin/workspace-internal

USER root
WORKDIR /home/workspace

EXPOSE 22 2376

ENTRYPOINT ["/usr/local/bin/workspace-internal", "entrypoint"]
