# Ride fixes after the first real ride (Nov 19, 2026)

Every judgment call made while fixing what the first Kickr ride showed, and what to test on the next ride. Written Nov 20, 2026.

Screenshots: `docs/screenshots/` (before and after, 1280x720).

## Part 1: ERG steps 1 / 5 / 10 W

- **Chose:** `ERG_STEPS_W = [1, 5, 10]`. Keys follow the same order as resistance: arrows 1 W, + / - 5 W, Shift + arrows 10 W.
- **Why:** the key handler already maps small / mid / large steps, so resistance, ERG and workout intensity now share one pattern. Nothing else changed.
