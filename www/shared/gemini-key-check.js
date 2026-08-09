// Validates a Gemini API key directly against Google's API (client-side,
// BYOK — never touches our backend, so this scales to any number of
// users with zero extra server load).
//
// Uses the ListModels endpoint (GET /v1beta/models) rather than an actual
// generateContent call on some specific model — this is deliberate.
// ListModels only tests whether the KEY itself authenticates; it has no
// dependency on any particular model existing. An earlier version of this
// called generateContent on a hardcoded model name, which meant that the
// moment Google deprecated/renamed that model (which happens routinely —
// Gemini models cycle every few months), EVERY key — valid or not — would
// start getting a 404 "model not found", misreported as a key problem.
// ListModels can't break that way, so this check stays correct
// indefinitely without needing to be updated every time Google ships a
// new model generation.
//
// Returns { status: 'valid'|'invalid'|'quota_exceeded'|'network_error'|'empty', message }
export async function checkGeminiApiKey(key) {
  if (!key || !key.trim()) return { status: 'empty', message: '' };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key.trim())}`,
      { method: 'GET' }
    );

    if (res.ok) return { status: 'valid', message: 'Key valid hai ✅' };

    const data = await res.json().catch(() => ({}));
    const reason = (data && data.error && data.error.status) || '';

    if (res.status === 429) {
      return { status: 'quota_exceeded', message: 'Is key ka quota/limit khatam ho gaya hai ⚠️' };
    }
    if (res.status === 400 || res.status === 401 || res.status === 403 || reason === 'INVALID_ARGUMENT' || reason === 'PERMISSION_DENIED' || reason === 'UNAUTHENTICATED') {
      return { status: 'invalid', message: 'Ye API key invalid hai ❌' };
    }
    return { status: 'unknown', message: 'Key check nahi ho paya (status ' + res.status + ')' };
  } catch (e) {
    return { status: 'network_error', message: 'Internet check karo — key verify nahi ho payi' };
  }
}
