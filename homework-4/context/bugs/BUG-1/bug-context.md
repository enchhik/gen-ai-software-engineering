# BUG-1 — `GET /users` returns wrong rows

Two unit tests in `tests/users.routes.test.js` are failing:

- "GET /users applies a default limit of 10" — expects the default page
  size to be 10 but observes a different count.
- "GET /users honours offset correctly" — expects
  `?offset=2&limit=3` to return user ids `[3, 4, 5]` but observes a
  different list.

Locate the cause and prepare a fix. The fix must make both failing tests
pass without regressing any test that is currently green.
