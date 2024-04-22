# Post Hotfix Action

Used for:
- Creates the post hotfix pull request

Usage:
```yaml
    steps:
      - uses: NoorDigitalAgency/post-hotfix@main
        name: Post Hotfix
        with:
          token: ${{ github.token }} # GitHub token
          branch_name: ${{ inputs.hotfix_branch }} # Hotfix branch name
          release_version: ${{ env.RELEASE_VERSION }} # the hotfix release version
```
