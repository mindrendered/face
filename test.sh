#!/bin/bash
# Run all tests for the faceless project
# Usage: ./test.sh

set -e

echo "=== Running social-login edge function tests ==="
if command -v deno &> /dev/null; then
  deno test --allow-net --allow-env supabase/functions/social-login/test.ts 2>&1
  echo ""
  echo "=== Running connections API tests ==="
  deno test --allow-net --allow-env src/services/__tests__/generation.test.ts 2>&1
  echo ""
  echo "=== All tests passed! ==="
else
  echo "Deno is not installed. Install it from https://deno.land"
  echo ""
  echo "Alternative: run tests manually with:"
  echo "  deno test --allow-net --allow-env supabase/functions/social-login/test.ts"
  echo "  deno test --allow-net --allow-env src/services/__tests__/generation.test.ts"
  exit 1
fi
