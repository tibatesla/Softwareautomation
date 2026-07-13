# Webhook Routes Diff

## Added
- Mounted the ad-performance webhook endpoint at `/api/webhooks/ad-performance`.
- Wired it to the existing ad performance controller and schema validation flow.

## Notes
- The route is mounted under the shared webhook prefix defined in the app entrypoint.
- The request is still protected by the shared Make webhook token middleware.
