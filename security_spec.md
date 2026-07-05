# Security Specification - Maximus Voice Agent

## Data Invariants
1. A user can only read and write their own profile document (`/users/{userId}`).
2. A user can only read and write messages in their own subcollection (`/users/{userId}/messages/{messageId}`).
3. Timestamps (`createdAt`, `updatedAt`, `timestamp`) must be validated against `request.time`.
4. Message roles must be either 'user' or 'model'.
5. Persona names and custom prompts must be length-constrained to prevent resource exhaustion.

## The Dirty Dozen - Malicious Payloads

1. **Identity Spoofing - Profile**: Attempt to create/update a user profile for a different UID.
   - `path`: `/users/attacker_uid`
   - `payload`: `{ "displayName": "Attacker", "ownerId": "victim_uid" }`
   - `Expectation`: PERMISSION_DENIED

2. **Identity Spoofing - Messages**: Attempt to post a message into another user's message history.
   - `path`: `/users/victim_uid/messages/new_msg`
   - `payload`: `{ "role": "user", "text": "I am the victim", "timestamp": request.time }`
   - `Expectation`: PERMISSION_DENIED

3. **Role Escalation**: Attempt to set a message role to 'admin' or 'system' (if logic only allows user/model).
   - `path`: `/users/my_uid/messages/msg1`
   - `payload`: `{ "role": "admin", "text": "Hacked", "timestamp": request.time }`
   - `Expectation`: PERMISSION_DENIED

4. **Timestamp Fraud**: Providing a client-side timestamp instead of server time.
   - `path`: `/users/my_uid/messages/msg2`
   - `payload`: `{ "role": "user", "text": "Past message", "timestamp": "2020-01-01T00:00:00Z" }`
   - `Expectation`: PERMISSION_DENIED

5. **Resource Exhaustion - Large Text**: Sending a 1MB string as a message or persona name.
   - `path`: `/users/my_uid`
   - `payload`: `{ "settings": { "personaName": "A".repeat(1000000) } }`
   - `Expectation`: PERMISSION_DENIED

6. **Shadow Field Injection**: Adding an unvalidated field like `isVerified: true` to a profile.
   - `path`: `/users/my_uid`
   - `payload`: `{ "displayName": "Me", "isVerified": true }`
   - `Expectation`: PERMISSION_DENIED

7. **Shadow Field Injection - Messages**: Adding `hidden: true` to a message.
   - `path`: `/users/my_uid/messages/msg3`
   - `payload`: `{ "role": "user", "text": "Hi", "hidden": true }`
   - `Expectation`: PERMISSION_DENIED

8. **Unauthenticated Write**: Attempting to write while not logged in.
   - `auth`: `null`
   - `Expectation`: PERMISSION_DENIED

9. **Unauthenticated Read**: Attempting to list all users.
   - `path`: `/users` (list)
   - `Expectation`: PERMISSION_DENIED

10. **ID Poisoning**: Using a 2KB junk string as a document ID.
    - `path`: `/users/` + "A".repeat(2000)
    - `Expectation`: PERMISSION_DENIED

11. **Admin Spoofing**: Attempting to write to an `/admins` collection (if it existed) or adding admin flags.
    - `path`: `/admins/my_uid`
    - `Expectation`: PERMISSION_DENIED (Default Deny)

12. **State Shortcutting**: Modifying `createdAt` after it has been set.
    - `path`: `/users/my_uid`
    - `payload`: `{ "createdAt": "new_time" }`
    - `Expectation`: PERMISSION_DENIED
