# Release Lookup Action

Used for:
- Provide the release version information as outputs and environment variables

Usage:
```yaml
    steps:
      - uses: NoorDigitalAgency/release-lookup@main
        name: Release Lookup
        with:
          token: ${{ github.token }} # GitHub token
          artifact_name: release-startup-outputs # Artifact name used by release-
          exports: true # If true, the outputs will be exported as environment variables
```
