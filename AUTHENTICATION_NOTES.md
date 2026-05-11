# Authentication Notes

## Important: PIN-Based Authentication

This application uses **PIN-based authentication** instead of traditional passwords.

### Key Points:

1. **PINs, not passwords**: Users authenticate using numeric PINs rather than alphanumeric passwords
2. **Validation**: All authentication forms and validation logic should expect PIN format
3. **Database considerations**: When working with Supabase auth tables and policies, remember that the authentication system uses PINs
4. **Security**: While PINs are used, they should still follow security best practices (length requirements, rate limiting, etc.)

### Implementation Notes:

- Login forms should have PIN-specific input fields (numeric keyboard on mobile)
- Error messages should reference "PIN" not "password"
- Password reset flows should be "PIN reset" flows
- Any authentication-related RLS policies need to account for PIN-based auth

### Why This Matters:

When creating RLS (Row Level Security) policies in Supabase, avoid making assumptions about password complexity or format. The authentication mechanism uses PINs, which may have different validation rules than traditional passwords.
