# Check the installed version

Before using a library's API, read the installed version and its current documentation.

**Why:** Models remember older versions. Code written from memory compiles against an API that no longer exists, or quietly uses deprecated behaviour.

**How to apply:**

- Read `package.json`, the lock file or `--version`.
- Pin exact versions in the project brief, and keep the list current.

**Where it lives:** every builder role.

Origin: field-tested.
