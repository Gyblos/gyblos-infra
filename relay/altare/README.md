# Deploy an Iroh relay on Altare

The image starts Iroh on HTTP port 8080 with the beta's open admission and
per-client limits. Altare terminates HTTPS and forwards WebSockets. The
container needs no persistent data folder. QUIC address discovery is disabled
because Altare Docker Apps expose TCP.

1. In GitHub Actions, run **Publish Altare relay image** on `main`.
   The job builds a Linux amd64 image, checks `/healthz` and `/ping` locally,
   pushes to GHCR and prints the digest in its run summary.
2. In Altare, select **Docker image** and paste the digest reference from that
   summary into **Image**. For a private package, configure registry access
   with a credential that can read the package.
3. Set **Port** to `8080`. Clear **Start command** and **Data folder**.
   Existing apps can switch images under **Settings → Image**.
4. Check the Altare endpoint and run the [open relay echo check](../../docs/operations.md#end-to-end-validation)
   against its HTTPS origin. Add the custom domain once the echo succeeds and
   repeat the check against the custom hostname.
