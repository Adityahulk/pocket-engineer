FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git python3 python3-pip python3-pytest ripgrep ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 engineer

USER engineer
WORKDIR /workspace
CMD ["bash"]

