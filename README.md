# Midday, between 'dawn' and 'dusk' release version provider

Used for:
- Provide the release version information as outputs and environment variables

Usage:
```yaml
    steps:
      - uses: NoorDigitalAgency/midday@main
        name: Midday
        with:
          token: ${{ github.token }} # GitHub token
          artifact_name: dawn-outputs # Artifact name used by dawn
          exports: true # If true, the outputs will be exported as environment variables
```
