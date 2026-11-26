FROM n0computer/iroh-relay:v1.4.1@sha256:f73d0028e9dcb08372d65ae48ec84e4c875812d754877c074a10658e3948d5d3
COPY --chmod=0444 relay.toml /relay.toml
USER 65534:65534
ENV RUST_LOG=warn
EXPOSE 8080
ENTRYPOINT ["/iroh-relay"]
CMD ["--config-path", "/relay.toml"]
