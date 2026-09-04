# Passkey relying-party association

Set `WEBAUTHN_RP_ID` to the production authentication host and set
`WEBAUTHN_EXPECTED_ORIGINS` to every exact HTTPS dashboard origin plus the
Android APK-key-hash origins for each debug/release signing certificate.

Publish the two files in this directory at the RP host:

- `assetlinks.json` at `https://<WEBAUTHN_RP_ID>/.well-known/assetlinks.json`.
- `apple-app-site-association` at `https://<WEBAUTHN_RP_ID>/.well-known/apple-app-site-association` (also serve it without a file extension).

Replace the certificate and Apple Team ID placeholders during deployment. The
Android package name is `com.fitnessplatform.app`; the iOS bundle ID is the
same. The mobile iOS entitlements intentionally use `auth.example.com` as a
safe build placeholder and must be changed to the production host before
signing, or supplied through an Xcode build-setting substitution.
