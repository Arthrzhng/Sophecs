// Marks a page as showing a sample account's verdict, result or challenge,
// so the analytics client sends nothing from it (src/lib/analytics/client.ts,
// onSamplePage). Rendered once per such page, at the page level, never in
// a list. The attribute matches SAMPLE_PAGE_ATTRIBUTE there; it is written
// out here because this file renders on the server, which must not import
// the client module.
export function SamplePageMarker() {
  return <div data-sophecs-sample-page="" hidden />;
}
