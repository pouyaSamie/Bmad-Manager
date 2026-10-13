// Compatibility entry point: authenticated, restricted AGY test bridge.
process.argv.push('--agy');
void import('./cli-gateway');
