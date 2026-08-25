# Unkey source packet

## Sources

1. Unkey launch and funding history
   - URL: https://www.unkey.com/blog/unkey-raises-1-5-million
   - Accessed: 2026-08-13
   - Type: official
   - Themes: Launch date, Early adoption
2. Unkey product documentation
   - URL: https://www.unkey.com/docs/introduction
   - Accessed: 2026-08-14
   - Type: official
   - Themes: Deployments, Gateway, Keys, Rate limits, Analytics
3. Unkey pricing
   - URL: https://www.unkey.com/pricing
   - Accessed: 2026-08-14
   - Type: official
   - Themes: Plans, Usage charges, Limits
4. Unkey security overview
   - URL: https://www.unkey.com/docs/security/overview
   - Accessed: 2026-08-14
   - Type: official
   - Themes: Key hashing, Storage
5. Why Unkey left serverless
   - URL: https://www.unkey.com/blog/serverless-exit
   - Accessed: 2026-08-13
   - Type: official
   - Themes: Architecture rewrite, Latency, Self-hosting
6. Unkey source repository
   - URL: https://github.com/unkeyed/unkey
   - Accessed: 2026-08-14
   - Type: community
   - Themes: Open source, Issues, Releases, Development activity
7. Unkey reviews on Product Hunt
   - URL: https://www.producthunt.com/products/unkey
   - Accessed: 2026-08-14
   - Type: independent-review-platform
   - Themes: Developer setup, Key management, Early product
8. Unkey listing on ToolAlts
   - URL: https://www.toolalts.dev/tool/unkey/
   - Accessed: 2026-08-14
   - Type: independent-review-platform
   - Themes: Directory coverage, Review-count cross-check
9. Self-managed API key discussion on Reddit
   - URL: https://www.reddit.com/r/nextjs/comments/1t2nktx/is_it_fine_to_self_manage_api_keys/
   - Accessed: 2026-08-13
   - Type: community
   - Themes: Build versus buy, Small-product needs, Permissions
10. API key management discussion on Reddit
   - URL: https://www.reddit.com/r/devops/comments/1cyri37
   - Accessed: 2026-08-13
   - Type: community
   - Themes: Gateways, Vault, Dedicated service
11. Independent hands-on Unkey review
   - URL: https://www.buildmvpfast.com/blog/unkey-open-source-api-key-management-rate-limiting-2026
   - Accessed: 2026-08-14
   - Type: editorial-review
   - Themes: Key creation, Verification, Rate limiting, Self-hosting

## Claims

- Unkey launched publicly on June 21, 2023. [verified; fact; official-launch]
- Unkey now combines API deployment, a request gateway, API keys, rate limiting, usage tracking, and analytics. [verified; fact; official-docs]
- Unkey hashes API keys with SHA-256 rather than storing the original key in plain text. [verified; fact; official-security, official-docs]
- Starter, Pro, and Business begin at $5, $25, and $50 monthly and include matching usage credits. Compute, storage, egress, and active keys can add usage charges. [verified; fact; official-pricing]
- The product is most useful when keys need permissions, limits, revocation, usage tracking, or protection across several services. [supported; reported-pattern; reddit-nextjs, reddit-devops, independent-review]
- A simple application with a small number of keys can reasonably keep hashed keys in its own database instead of adding another service. [supported; reported-pattern; reddit-nextjs, reddit-devops]
- Unkey replaced its first serverless architecture after describing latency, caching, local-development, and operational problems. [verified; fact; official-rewrite]
